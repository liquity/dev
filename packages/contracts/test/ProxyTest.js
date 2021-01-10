
const DSProxy = artifacts.require("./DSProxy.sol")
const Monitor = artifacts.require("./Monitor.sol")
const MonitorProxy = artifacts.require("./MonitorProxy.sol")
const SaverProxy = artifacts.require("./SaverProxy.sol")
const SubscriptionsProxy = artifacts.require("./SubscriptionsProxy.sol")
const Subscriptions = artifacts.require("./Subscriptions.sol")
const ProxyFactory = artifacts.require("./DSProxyFactory.sol")
const ProxyRegistry = artifacts.require("./ProxyRegistry.sol")
const DSGuardFactory = artifacts.require("./DSGuardFactory.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")

const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const assertRevert = th.assertRevert
const ZERO_ADDRESS = th.ZERO_ADDRESS

const getProxy = async (acc, registry) => {2
    let proxyAddr = await registry.proxies(acc)
    if (proxyAddr === ZERO_ADDRESS) {
        await registry.build({from: acc})
        proxyAddr = await registry.proxies(acc)
    }
    let proxy = await DSProxy.at(proxyAddr)
    return { proxy, proxyAddr }
};

const getAbiFunction = (contract, functionName) => {
    const abi = contract.abi;
    return abi.find(abi => abi.name === functionName)
};

 // This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
 const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

contract('Proxy', async accounts => {
    const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    const MIN_RATIO = '1240000000000000000'
    const _18_zeros = '000000000000000000'
    const [owner, alice, bob] = accounts
    // With 68 iterations redemption costs about ~10M gas, 
    // and each iteration accounts for ~144k more
    const redeemMaxIterations = 68
    // Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
    // required to get a statistically "good" hint is larger than this, the search for the hint will
    // be broken up into multiple getApproxHint() calls.
    // This should be low enough to work with popular public Ethereum providers like Infura without
    // triggering any fair use limits.
    const maxNumberOfTrialsAtOnce = 2500;
    
    let monitorProxy, monitor, subscriptionsProxy, subscriptions
    let contracts, borrowerOperations, troveManager, priceFeed
    let factory, guardFactory, registry, scriptProxy, web3Proxy

    before(async () => {
        //Deploy the entire system
        contracts = await deploymentHelper.deployLiquityCore()
        contracts.troveManager = await TroveManagerTester.new()
        const LQTYContracts = await deploymentHelper.deployLQTYContracts()

        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        borrowerOperations = contracts.borrowerOperations
        troveManager = contracts.troveManager
        priceFeed = contracts.priceFeedTestnet

        monitorProxy = await MonitorProxy.new()
        MonitorProxy.setAsDeployed(monitorProxy)
        
        subscriptions = await Subscriptions.new()
        Subscriptions.setAsDeployed(subscriptions)

        guardFactory = await DSGuardFactory.new()
        DSGuardFactory.setAsDeployed(guardFactory)

        subscriptionsProxy = await SubscriptionsProxy.new(
            guardFactory.address, 
            subscriptions.address, 
            monitorProxy.address
        )
        SubscriptionsProxy.setAsDeployed(subscriptionsProxy)
        
        scriptProxy = await SaverProxy.new(borrowerOperations.address, troveManager.address)
        SaverProxy.setAsDeployed(scriptProxy)

        monitor = await Monitor.new(
            monitorProxy.address, 
            subscriptions.address, 
            scriptProxy.address,
            troveManager.address,
            priceFeed.address
        )
        Monitor.setAsDeployed(monitor)

        // We must deploy DSProxyFactory because we call the build function
        // inside it in order to create DSproxies on behalf of Trove owners
        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        registry = await ProxyRegistry.new(factory.address)
        ProxyRegistry.setAsDeployed(registry)
        
        console.log("alice...", alice.address)
        const proxyInfo = await getProxy(alice, registry)
        const proxyAddr = proxyInfo.proxyAddr;
        console.log(proxyAddr)
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)

        await subscribe(alice, MIN_RATIO);
    })

    describe('Proxy integration test', async accounts => { 
        // should fail unauthorized caller closing Trove
        // should fail caller authorized but not for closing
        
        it("set up Trove via DSproxy, subscribe to automation", async () => {
            
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'open'),
                [ 0 ]
            );
            await assertRevert(
                web3Proxy.methods['execute(address,bytes)']
                (ZERO_ADDRESS, data).send({ from: alice, value: dec(1, 'ether'), gas:10000000 }),
                "ds-proxy-target-address-required"
            )
            
            await web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send(
                { from: alice, value: dec(1, 'ether') 
            });
            
            // TODO
            // assert that new trove created by alice added collateral 
            // and also increasing its raw ETH balance? 
            const activePool_ETH_After = await contracts.activePool.getETH()
            const activePool_RawEther_After = await web3.eth.getBalance(contracts.activePool.address)
            
            // assert updating the correct trove properties in TroveManager
            // changing ETH and debt trackers in ActivePool
            assert.equal(activePool_ETH_After, dec(1, 'ether'))
            assert.equal(activePool_RawEther_After, dec(1, 'ether'))

            await subscribe(alice, MIN_RATIO)

        })
        it("Proxity monitor calling SaverProxy", async () => {
            // open two troves
            // price drop
            await priceFeed.setPrice(dec(100, 18))
            var price = await priceFeed.getPrice()
    
            const AliceTrove = await troveManager.Troves(alice)
            const coll =  AliceTrove[1]
            const debt = AliceTrove[0]
            
            const nowICR = await troveManager.computeICR(coll, debt, price)
            const minICR = await subscriptions.getMinRatio(alice.address)
    
            assert.isTrue(nowICR < minICR)
            
            // determine how much debt to sell to recover collateralization to be above minimum
            let amount = debt.mul(minICR).sub(coll).div(minICR + 1); // TODO 1
            // TODO account for redemption fee
            
            const {
                firstRedemptionHint,
                partialRedemptionHintICR
            } = await contracts.hintHelpers.getRedemptionHints(
                amount, price
            );
            
            // We don't need to first obtain an approximate hint for _partialRedemptionHintICR via getApproxHint(), 
            // for this test, since it's not the subject of this test case, and the list is very small, 
            // so the correct position is quickly found 
            const { 0: partialRedemptionHint } = await sortedTroves.findInsertPosition(
                partialRedemptionHintICR, price,
                alice, // TODO alice == her DSProxy?
                alice
            )
      
            // Don't pay for gas, as it makes it easier to calculate the received Ether
            /*
            wait repayFor(alice, // TODO check sender
                amount, firstRedemptionHint,
                partialRedemptionHint,
                partialRedemptionHintICR,
            )
            */
        })
    })
})

const subscribe = async (account, minRatio) => {
    try {
        const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(subscriptionsProxy, 'subscribe'),
        [minRatio]);

        const tx = await web3Proxy.methods['execute(address,bytes)'](subscriptionsProxy.address, data).send({
            from: account.address, gas: 400000, gasPrice: 7100000000});

        console.log(tx);
    } catch(err) {
        console.log(err);
    }
}

const repayFor = async (user, /* minRatio, */  firstRedemptionHint, partialRedemptionHint, partialRedemptionHintICR) => {
    try {
        const tx = await monitor.methods.repayFor(
           //[account.address, minRatio],
           firstRedemptionHint, 
           partialRedemptionHint, 
           partialRedemptionHintICR, 
           redeemMaxIterations   
        ).send({
            from: user.address, gas: 4500000, gasPrice: gasPrice
        });
        console.log(tx);
    } catch(err) {
        console.log(err);
    }
}

const repay = async (account, /* minRatio, */ firstRedemptionHint, partialRedemptionHint, partialRedemptionHintICR) => {
    try {
        const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'repay'),
            [//[account.address, minRatio],
                firstRedemptionHint, 
                partialRedemptionHint, 
                partialRedemptionHintICR, 
                redeemMaxIterations  
            ]);

        const tx = await web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send({
            from: account.address, gas: 5000000, gasPrice: gasPrice
        });
        console.log(tx);
    } catch(err) {
        console.log(err);
    }
}
