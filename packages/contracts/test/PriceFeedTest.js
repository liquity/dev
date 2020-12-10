
const PriceFeed = artifacts.require("./PriceFeed.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockAggregator = artifacts.require("./MockAggregator.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const dec = th.dec
const assertRevert = th.assertRevert

const kovanAggregatorAddress = "0x9326BFA02ADD2366b30bacB125260Af641031331"

contract('PriceFeed: Liquity functions with the caller restricted to Liquity contract(s)', async accounts => {

    const [owner, alice, bob, carol] = accounts;
    let priceFeedTestnet
    let priceFeed
    let zeroAddressPriceFeed
    let mockAggregator
  
    before(async () => {
        priceFeedTestnet = await PriceFeedTestnet.new()
        PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

        priceFeed = await PriceFeed.new(kovanAggregatorAddress)
        PriceFeed.setAsDeployed(priceFeed)

        zeroAddressPriceFeed = await PriceFeed.new()
        PriceFeed.setAsDeployed(zeroAddressPriceFeed)

        mockAggregator = await MockAggregator.new()
        MockAggregator.setAsDeployed(mockAggregator)
    })
    describe('PriceFeed internal testing contract', async accounts => { 
        it("getPrice before setPrice should return the default price", async () => {
            const price = await priceFeedTestnet.getPrice()
            assert.equal(price, dec(200, 18))
        })
        it("should be able to getPrice after setPrice, output of former matching input of latter", async () => {
            await priceFeedTestnet.setPrice(dec(100, 18))
            const price = await priceFeedTestnet.getPrice()
            assert.equal(price, dec(100, 18))
        })
    })
    describe('Actual PriceFeed contract', async accounts => { 
        it("getPrice should fail on contract with no aggregator address set", async () => {
            try {
                const price = await zeroAddressPriceFeed.getPrice()
                assert.isFalse(price.receipt.status)
            } catch (err) {
                assert.include(err.message, "function call to a non-contract account")
            }
        })
        it("setAddresses should fail whe called by nonOwner", async () => {
            
            await assertRevert(priceFeed.setAddresses(kovanAggregatorAddress, { from: alice }))

        })
        it("setAddresses should fail after being called once by owner", async () => {
            // Owner can successfully set any address
            const txOwner = await priceFeed.setAddresses(mockAggregator.address, { from: owner })
            assert.isTrue(txOwner.receipt.status)      
            
            await assertRevert(priceFeed.setAddresses(kovanAggregatorAddress, { from: owner }))
        })
        it("getPrice should work regardless how many decimals returned by aggregator", async () => {
            var price = await priceFeed.getPrice()
            assert.equal(price, 1000)
            await mockAggregator.setPath(2) // 21 digits
            var price = await priceFeed.getPrice()
            assert.equal(price, 1)
            await mockAggregator.setPath(3) // 17 digits
            var price = await priceFeed.getPrice()
            assert.equal(price, 10000)
        })
        it("getPrice should revert with bad timestamp", async () => {
            await mockAggregator.setPath(4) // zero timestamp
            await assertRevert(priceFeed.getPrice())
        })
        it("getPrice should revert with negative price", async () => {
            await mockAggregator.setPath(5) // zero timestamp
            await assertRevert(priceFeed.getPrice())
        })
    })
})