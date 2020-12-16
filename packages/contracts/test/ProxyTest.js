
const DSProxy = artifacts.require("./DSProxy.sol");
const ProxyRegistry = artifacts.require("./ProxyRegistry.sol");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const dec = th.dec
const assertRevert = th.assertRevert
const getProxy = async (acc) => {
    let proxyAddr = await registry.proxies(acc);
    if (proxyAddr === nullAddress) {
        await registry.build(acc, {from: acc});
        proxyAddr = await registry.proxies(acc);
    }
    proxy = await DSProxy.at(proxyAddr);
    return { proxy, proxyAddr };
};
contract('Proxy', async accounts => {
    const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const [owner, alice] = accounts;
    let registry, proxy, proxyAddr, web3Proxy;
    let contracts, borrowerOperations;
    
    before(async () => {
        //Deploy the entire system
        contracts = await deploymentHelper.deployLiquityCore()
        borrowerOperations = contracts.borrowerOperations
        const LQTYContracts = await deploymentHelper.deployLQTYContracts()
        await deploymentHelper.connectLQTYContracts(LQTYContracts)
        await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
        await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)
        
        //Deploy the Proxy system
        registry = await ProxyRegistry.new()
        ProxyRegistry.setAsDeployed(registry)
        const proxyInfo = await getProxy(alice);
        proxy = proxyInfo.proxy;
        proxyAddr = proxyInfo.proxyAddr;
        web3Proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr);
    })

    describe('PriceFeed internal testing contract', async accounts => { 
        it("", async () => {
            // await borrowerOperations.openTrove(0, alice, { from: alice, value: dec(1, 'ether') })
            let collToken = ETH_ADDRESS;
            let depositAmount = web3.utils.toWei('2', 'ether');
            
            const data = web3.eth.abi.encodeFunctionCall(getAbiFunction(borrowerOperations, 'openTrove'),
                [ 1 ]
            );
            await web3Proxy.methods['execute(address,bytes)']
            (mcdCreateTakerAddr, data).send({from: accounts[0], gas: 3500000, value: depositAmount});

        })
    })

})
