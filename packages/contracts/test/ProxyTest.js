
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
 // const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

contract('Proxy', async accounts => {
    
    var   MIN_RATIO = '1420000000000000000'
    const _18_zeros = '000000000000000000'
    const [alice, bob] = accounts
    
    // With 68 iterations redemption costs about ~10M gas, 
    // and each iteration accounts for ~144k more
    const redeemMaxIterations = 68
    
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
    
    const repayFor = async (user, minRatio, redemptionAmount, firstRedemptionHint, partialRedemptionHint, partialRedemptionHintICR) => {
        try {
            const tx = await monitor.repayFor(
               [user, minRatio],
               redemptionAmount,
               firstRedemptionHint, 
               partialRedemptionHint, 
               partialRedemptionHintICR, 
               redeemMaxIterations, { from: user } 
            )
            console.log(tx);
        } catch(err) {
            console.log("\nCATCH\n")
            console.log(err);
        }
    }
    
    const repay = async (account, redemptionAmount, firstRedemptionHint, partialRedemptionHint, partialRedemptionHintICR) => {
        try {
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'repay'), [   
                redemptionAmount,
                firstRedemptionHint, 
                partialRedemptionHint, 
                partialRedemptionHintICR, 
                redeemMaxIterations  
            ]);
    
            const tx = await web3Proxy.methods['execute(address,bytes)'](scriptProxy.address, data).send({ from: account });
            console.log(tx);
        } catch(err) {
            console.log(err);
        }
    }    

    before(async () => {
        //Deploy the core system
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
        
        const proxyInfo = await getProxy(alice, registry)
        proxyAddr = proxyInfo.proxyAddr;
        
        console.log("alice...", alice)
        console.log(proxyAddr)
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)
    })

    describe('Proxy integration test', async accounts => { 
        
        it("set up Trove via DSproxy", async () => {
          
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(scriptProxy, 'open'),
                [ dec(40, 18) ]
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
            await borrowerOperations.openTrove(0, bob, { from: bob, value: dec(2, 'ether') })
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

        it("subscribe to automation, which calls the script", async () => {
            var price = await priceFeed.getPrice()

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

            // TODO this repayFor call will fail because minICR hasn't been reached yet
            /*
            await repayFor(proxyAddr, minICR,
                amount, firstRedemptionHint,
                partialRedemptionHint,
                partialRedemptionHintICR,
            )
            */

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
        
            let numerator = debtAfter.mul(minICR).div(toBN('1' + _18_zeros)).sub(collInDoll)
            var amount = numerator.mul(toBN('1' + _18_zeros)).div(minICR.add(toBN('1' + _18_zeros))).add(toBN(1)); 
            
            amount = amount.add(toBN(100)) // solely to account for arithmetic precision loss from all the BN ops    

            // TODO account for redemption fee?
            let newDebt = debtAfter.sub(amount)
            let gainedColl = amount.mul(toBN('1' + _18_zeros)).div(price) 
            let newColl = collAfter.add(gainedColl)
            let newICR = await troveManager.computeICR(newColl, newDebt, price)
            
            assert.isTrue(newICR.gte(minICR))
        
            const { firstRedemptionHint,
                partialRedemptionHintICR } = await contracts.hintHelpers.getRedemptionHints(
                amount.toString(), price
            );
            
            // We don't need to first obtain an approximate hint for _partialRedemptionHintICR via getApproxHint(), 
            // for this test, since it's not the subject of this test case, and the list is very small, 
            // so the correct position is quickly found 
            const { 0: partialRedemptionHint } = await contracts.sortedTroves.findInsertPosition(
                partialRedemptionHintICR, price, alice, alice
            )

            // Don't pay for gas, as it makes it easier to calculate the received Ether
        
            await repayFor(proxyAddr, minICR, 
                amount, firstRedemptionHint,
                partialRedemptionHint,
                partialRedemptionHintICR,
            )

            const AliceTroveFinal = await troveManager.Troves(proxyAddr)
            const debtFinal = AliceTroveBefore[0]
            console.log("debtFinal", debtFinal.toString())
        })
    })
})
