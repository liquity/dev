
//const { Contract } = require('@ethersproject/contracts');
const DSProxy = artifacts.require("./DSProxy.sol");
const ProxyScript = artifacts.require("./ProxyScript.sol");
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
    proxy = await DSProxy.at(proxyAddr);
    return { proxy, proxyAddr };
};
const getAbiFunction = (contract, functionName) => {
    const abi = contract.abi;
    return abi.find(abi => abi.name === functionName);
};

contract('Proxy', async accounts => {
    const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const [owner, alice] = accounts;
    
    let contracts, borrowerOperations, priceFeed;
    let factory, registry, proxy, script, proxyAddr, web3Proxy;

    
    before(async () => {
        //Deploy the entire system
        contracts = await deploymentHelper.deployLiquityCore()
        const LQTYContracts = await deploymentHelper.deployLQTYContracts()

        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        borrowerOperations = contracts.borrowerOperations
        priceFeed = contracts.priceFeedTestnet

        // We must deploy DSProxyFactory because we call the build function
        // inside it in order to create DSproxies on behalf of Trove owners
        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        registry = await ProxyRegistry.new(factory.address)
        ProxyRegistry.setAsDeployed(registry)

        script = await ProxyScript.new(borrowerOperations.address)
        ProxyScript.setAsDeployed(script)
        
        const proxyInfo = await getProxy(alice, registry)
        proxy = proxyInfo.proxy;
        proxyAddr = proxyInfo.proxyAddr;
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)
        //web3Proxy = new Contract(DSProxy.abi, proxyAddr)
    })
    describe('Proxy internal testing contract', async accounts => { 
        it("try basic script", async () => {
            // this still works xD 
            // await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
            
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(script, 'open'),
                [ 0 ]
            );
            
            // const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(borrowerOperations, 'openTrove'),
            //     [ 10000000, contracts.troveManager.address ]
            // );

            await assertRevert(
                web3Proxy.methods['execute(address,bytes)']
                (ZERO_ADDRESS, data).send({ from: alice, value: dec(1, 'ether'), gas:10000000 }),
                "ds-proxy-target-address-required"
            )
            
            // TODO  this reverts
            await web3Proxy.methods['execute(address,bytes)']
                (script.address, data).send({ from: alice, value: dec(1, 'ether') });
            // this also reverts
            // await web3Proxy.methods['execute(address,bytes)']
            //     (borrowerOperations.address, data).send({ from: alice, value: dec(1, 'ether'), gas:10000000 });
                
            const activePool_ETH_After = await contracts.activePool.getETH()
            const activePool_RawEther_After = await web3.eth.getBalance(contracts.activePool.address)
            assert.equal(activePool_ETH_After, dec(1, 'ether'))
            assert.equal(activePool_RawEther_After, dec(1, 'ether'))
            // assert that new trove created by alice

            // assert updating the correct trove properties in TroveManager
            
            // changing ETH and debt trackers in ActivePool
            // and also increasing its raw ETH balance? 
        })
    })

})
