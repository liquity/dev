
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
const toBN = th.toBN
const assertRevert = th.assertRevert
const ZERO_ADDRESS = th.ZERO_ADDRESS

const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

const getRedemptionParams = async (contracts, LUSDAmount, price) => {
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(LUSDAmount, price, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const approxHint = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, randomInteger())

    const exactPartialRedemptionHint = await contracts.sortedTroves.findInsertPosition(
        partialRedemptionNewICR,
        approxHint[0], approxHint[0]
    )
    return [
        firstRedemptionHint,
        exactPartialRedemptionHint[0],
        exactPartialRedemptionHint[1],
        partialRedemptionNewICR, 0, 0
    ]
}

const getProxy = async (acc, registry) => {
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

contract('Proxy', async accounts => {
    var   MIN_RATIO = '1420000000000000000'
    const _18_zeros = '000000000000000000'
    const [owner, alice, bob, carol] = accounts
    const bountyAddress = accounts[998]
    const lpRewardsAddress = accounts[999]

    let monitorProxy, monitor, subscriptionsProxy, subscriptions
    let contracts, borrowerOperations, troveManager, priceFeed
    let factory, guardFactory, registry, scriptProxy, web3Proxy, proxyAddr

    const subscribe = async (account, minRatio) => {
        try {
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(subscriptionsProxy, 'subscribe'),
            [minRatio]);

            const tx = await web3Proxy.methods['execute(address,bytes)'](subscriptionsProxy.address, data).send({ from: account });
        } catch(err) {
            console.log(err);
        }
    }
    // 
    const repayFor = async (caller, user, minRatio, redemptionAmount, price) => {
        try {
            let params = await getRedemptionParams(contracts, redemptionAmount, price)
            const tx = await monitor.repayFor(
               [user, minRatio], redemptionAmount, params[0], params[1], params[2], params[3], params[4], params[5],
               { from: caller } 
            )
        } catch(err) {
            console.log(err);
        }
    }
    
    const repay = async (account, redemptionAmount, price) => {
        try {
            let params = await getRedemptionParams(contracts, redemptionAmount, price)

            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'repay'), [   
                redemptionAmount, ...params
            ]);
            const tx = await web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send({ from: account });
        } catch(err) {
            console.log(err);
        }
    }    

    before(async () => {
        //Deploy the core system
        contracts = await deploymentHelper.deployLiquityCore()
        const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress)
        contracts.troveManager = await TroveManagerTester.new()
        contracts = await deploymentHelper.deployLUSDToken(contracts)

        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        borrowerOperations = contracts.borrowerOperations
        troveManager = contracts.troveManager
        priceFeed = contracts.priceFeedTestnet

        monitorProxy = await MonitorProxy.new({ from: owner })
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
        monitorProxy.setMonitor(monitor.address, {from: owner})

        // We must deploy DSProxyFactory because we call the build function
        // inside it in order to create DSproxies on behalf of Trove owners
        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        registry = await ProxyRegistry.new(factory.address)
        ProxyRegistry.setAsDeployed(registry)
        
        const proxyInfo = await getProxy(alice, registry)
        proxyAddr = proxyInfo.proxyAddr;
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)
    })

    describe('Proxy integration test', async accounts => { 
        
        it("set up Trove via DSproxy", async () => {
          
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'open'),
                [  0, dec(40, 18) ]
            );
            await assertRevert(
                web3Proxy.methods['execute(address,bytes)']
                (ZERO_ADDRESS, data).send({ from: alice, value: dec(1, 'ether'), gas:10000000 }),
                "ds-proxy-target-address-required"
            )
            
            // cannot open a trove for Bob using Alice's DSproxy (only owner or authorized contract can call execute)
            await assertRevert(
                web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send({ 
                    from: bob, value: dec(1, 'ether') 
            }))
            assert.isFalse(await contracts.sortedTroves.contains(proxyAddr))

            // so Bob will open a Trove the good old fashioned way :)
            await borrowerOperations.openTrove(0, 0, bob, bob, { from: bob, value: dec(2, 'ether') })
            assert.isTrue(await contracts.sortedTroves.contains(bob))

            // Now Alice finally opens a trove using her DSproxy
            await web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send({
                from: alice, value: dec(1, 'ether') 
            });

            // the address of the owner of the trove from Liquity's perspective is actually the DSproxy address
            assert.isTrue(await contracts.sortedTroves.contains(proxyAddr))
            
            const aliceTrove = await troveManager.Troves(proxyAddr)
            const aliceColl =  aliceTrove[1]
            const aliceDebt = aliceTrove[0]

            const activePool_Debt_After = (await contracts.activePool.getLUSDDebt()).toString()
            const activePool_ETH_After = (await contracts.activePool.getETH()).toString()
            const activePool_RawEther_After = await web3.eth.getBalance(contracts.activePool.address)
            
            assert.equal(activePool_Debt_After, dec(60, 18)) // from alice 40 + 10, + 10 from bob
            assert.equal(aliceDebt, dec(50, 18))
            assert.equal(activePool_ETH_After, dec(3, 'ether'))
            assert.equal(activePool_RawEther_After, dec(3, 'ether'))
            assert.equal(aliceColl, dec(1, 'ether'))
        })

        /*
        const price = dec(100, 18)
        const coll = 0
        const debt = 0
        const ICR = (await troveManager.computeICR(coll, debt, price)).toString()
        assert.equal(ICR, 0)
        */

        it("subscribe to automation, which calls the script", async () => {

            // we open this trove, having a worse ICR than alice's, so that alice can redeem 
            // from this trove when she calls redeem without redeeming from her own trove
            await borrowerOperations.openTrove(0, dec(50, 18), carol, carol, { from: carol, value: dec(1, 'ether') })

            var price = await priceFeed.getPrice()

            // it doesn't really matter who the caller is since we've commented out the onlyApproved modifier
            let caller = bob 
        
            await subscribe(alice, MIN_RATIO);
        
            // even though alice is invoking the subscription
            // she is doing this via her DSproxy by way of the SubscriptionProxy contract
            // thus the subscription actually belongs to her DSproxy address
            assert.isTrue(await subscriptions.isSubscribed(proxyAddr))
            const minICR = await subscriptions.getMinRatio(proxyAddr)
            
            const AliceTroveBefore = await troveManager.Troves(proxyAddr)
            const debtBefore = AliceTroveBefore[0]
            const collBefore =  AliceTroveBefore[1]
            const ICRbefore = await troveManager.computeICR(collBefore, debtBefore, price)

            assert.isTrue(ICRbefore > minICR)

            // cannot execute script because minICR hasn't been reached yet
            const { 0: res } = await monitor.canCall(0, proxyAddr)
            assert.isFalse(res)

            await priceFeed.setPrice(dec(70, 18))
            price = await priceFeed.getPrice()

            assert.isFalse(await troveManager.checkRecoveryMode())
            
            const AliceTroveAfter = await troveManager.Troves(proxyAddr)
            const debtAfter = AliceTroveAfter[0]
            const collAfter =  AliceTroveAfter[1]
            const collInDoll = collAfter.mul(price).div(toBN('1' + _18_zeros))            
            const ICRafter = await troveManager.computeICR(collAfter, debtAfter, price)

            assert.isTrue(ICRafter < minICR)

            // determine how much debt to redeem for coll and top up trove with
            // to recover collateralization to be above minimum (should be half a dollar)
            var amount = debtAfter.mul(minICR).div(toBN('1' + _18_zeros)).sub(collInDoll)
            amount = amount.add(toBN(100)) // solely to account for arithmetic precision loss from all the BN ops

            let gainedColl = amount.mul(toBN('1' + _18_zeros)).div(price) 
            let newColl = collAfter.add(gainedColl)
            let newICR = await troveManager.computeICR(newColl, debtAfter, price)
            
            assert.isTrue(newICR.gte(minICR))
        
            await repayFor(caller, proxyAddr, minICR, amount, price)

            const AliceTroveFinal = await troveManager.Troves(proxyAddr)
            const collFinal = AliceTroveFinal[1]
            
            // account for discrepancy resulting from redemption fee
            const delta = Number(newColl.sub(collFinal)) / Number('1' + _18_zeros)
        
            assert.isTrue(delta < 0.0001)
        })
    })
})
