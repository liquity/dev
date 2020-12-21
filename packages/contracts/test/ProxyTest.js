
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
    
    let contracts;
    let factory, registry, proxy, script, proxyAddr, web3Proxy;

    
    before(async () => {
        //Deploy the entire system
        contracts = await deploymentHelper.deployLiquityCore()
        const LQTYContracts = await deploymentHelper.deployLQTYContracts()
        
        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        //Deploy the Proxy system
        factory = await ProxyFactory.new()
        ProxyFactory.setAsDeployed(factory)

        registry = await ProxyRegistry.new(factory.address)
        ProxyRegistry.setAsDeployed(registry)

        script = await ProxyScript.new(contracts.borrowerOperations.address)
        ProxyScript.setAsDeployed(script)
        
        const proxyInfo = await getProxy(alice, registry)
        proxy = proxyInfo.proxy;
        proxyAddr = proxyInfo.proxyAddr;
        
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr)
    })
    // 2.0167
    describe('PriceFeed internal testing contract', async accounts => { 
        it("", async () => {
            // await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
            let collToken = ETH_ADDRESS;
            let depositAmount = web3.utils.toWei('2', 'ether');
            
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(script, 'open'),
                [ 100 ]
            );
            // assert that new trove created by alice

            await web3Proxy.methods['execute(address,bytes)']
                (script.address, data).send({ from: alice, value: dec(1, 'ether') });
        })
    })

})
