
// const DSProxy = contract.fromArtifact("DSProxy");
// const ProxyRegistryInterface = contract.fromArtifact("ProxyRegistryInterface");

// artifacts.require("./PriceFeed.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const dec = th.dec
const assertRevert = th.assertRevert

contract('Proxy', async accounts => {

    const [owner, alice] = accounts;

    /*
    const getProxy = async (registry, acc, web3) => {
        let proxyAddr = await registry.proxies(acc);
    
        if (proxyAddr === nullAddress) {
            await registry.build(acc, {from: acc});
            proxyAddr = await registry.proxies(acc);
        }
    
        proxy = await DSProxy.at(proxyAddr);
        let web3proxy = null;
    
        if (web3 != null) {
            web3proxy = new web3.eth.Contract(DSProxy.abi, proxyAddr);
        }
    
        return { proxy, proxyAddr, web3proxy };
    };
    */
    before(async () => {
        //priceFeedTestnet = await PriceFeedTestnet.new()
        //PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

        //Deploy the entire system

        //Deploy the Proxy system
        //registry = await ProxyRegistryInterface.at(makerAddresses["PROXY_REGISTRY"]);

        //const proxyInfo = await getProxy(registry, accounts[0]);
    })

    describe('PriceFeed internal testing contract', async accounts => { 
        it("", async () => {
            
        })
    })

})
