
const DSProxy = artifacts.require("./DSProxy.sol");
const ProxyScript = artifacts.require("./SaverProxy.sol");
const Monitor = artifacts.require("./Monitor.sol");
const MonitorProxy = artifacts.require("./MonitorProxy.sol");

const SubscriptionProxy = artifacts.require("./SubscripionProxy.sol");
const Subscriptions = artifacts.require("./Subscripions.sol");
const ProxyFactory = artifacts.require("./DSProxyFactory.sol");
const ProxyRegistry = artifacts.require("./ProxyRegistry.sol");

const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const assertRevert = th.assertRevert
const ZERO_ADDRESS = th.ZERO_ADDRESS

const getProxy = async (acc, registry) => {
    let proxyAddr = await registry.proxies(acc);
    if (proxyAddr === ZERO_ADDRESS) {
        await registry.build({from: acc});
        console.log('built one')
        proxyAddr = await registry.proxies(acc);
    }
    let proxy = await DSProxy.at(proxyAddr);
    return { proxy, proxyAddr };
};

const getAbiFunction = (contract, functionName) => {
    const abi = contract.abi;
    return abi.find(abi => abi.name === functionName);
};

contract('Proxy', async accounts => {
    const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const [owner, alice] = accounts;
    
    let monitorProxy, monitor, subscriptionsProxy, subscriptions;
    let contracts, borrowerOperations, priceFeed;
    let factory, registry, script, web3Proxy, saver;

    before(async () => {
        //Deploy the entire system
        contracts = await deploymentHelper.deployLiquityCore()
        const LQTYContracts = await deploymentHelper.deployLQTYContracts()

        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        borrowerOperations = contracts.borrowerOperations
        priceFeed = contracts.priceFeedTestnet

        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        // We must deploy DSProxyFactory because we call the build function
        // inside it in order to create DSproxies on behalf of Trove owners
        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        registry = await ProxyRegistry.new(factory.address)
        ProxyRegistry.setAsDeployed(registry)

        script = await ProxyScript.new(borrowerOperations.address)
        ProxyScript.setAsDeployed(script)

        monitor = await Monitor.new()
        Monitor.setAsDeployed(monitor)
        monitorProxy = artifacts.require("./MonitorProxy.sol");
        subscriptions = artifacts.require("./Subscripions.sol");
        subscriptionProxy = artifacts.require("./SubscripionProxy.sol");
        

        
        const proxyInfo = await getProxy(alice, registry)
        const proxyAddr = proxyInfo.proxyAddr;
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)
        
    })

    describe('Proxy integration test', async accounts => { 
        // should fail unauthorized caller closing Trove
        // should fail caller authorized but not for closing
        
        it("direct proxy, should top up deposit with gains", async () => {
            
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(script, 'open'),
                [ 0 ]
            );
            await assertRevert(
                web3Proxy.methods['execute(address,bytes)']
                (ZERO_ADDRESS, data).send({ from: alice, value: dec(1, 'ether'), gas:10000000 }),
                "ds-proxy-target-address-required"
            )
            
            await web3Proxy.methods['execute(address,bytes)'](script.address, data).send(
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
        })
    })

    it("Proxity monitor calling SaverProxy", async () => {
        // open two troves
        // price drop, one gets liquidated
        // withdraw collateral surplus, draw more debt, deposit
    })

    it("", async () => {
        //
    })

})
