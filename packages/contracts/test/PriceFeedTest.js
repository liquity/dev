
const PriceFeed = artifacts.require("./PriceFeed.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockAggregator = artifacts.require("./MockAggregator.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const dec = th.dec
const assertRevert = th.assertRevert

contract('PriceFeed', async accounts => {

    const [owner, alice] = accounts;
    let priceFeedTestnet
    let priceFeed
    let zeroAddressPriceFeed
    let mockAggregator
  
    before(async () => {
        priceFeedTestnet = await PriceFeedTestnet.new()
        PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

        priceFeed = await PriceFeed.new()
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
            await assertRevert(
                priceFeed.setAddresses(mockAggregator.address, { from: alice }),
                "Ownable: caller is not the owner"
            )
        })
        it("setAddresses should fail after being called once by owner", async () => {
            // Owner can successfully set any address
            const txOwner = await priceFeed.setAddresses(mockAggregator.address, { from: owner })
            assert.isTrue(txOwner.receipt.status)      
            
            await assertRevert(
                priceFeed.setAddresses(mockAggregator.address, { from: owner }),
                "Ownable: caller is not the owner"    
            )
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
            await mockAggregator.setPath(4) 
            await assertRevert(
                priceFeed.getPrice(),
                "PriceFeed: price timestamp from aggregator is 0, or in future"
            )
        })
        it("getPrice should revert with negative price", async () => {
            await mockAggregator.setPath(5) 
            await assertRevert(
                priceFeed.getPrice(),
                "PriceFeed: price answer from aggregator is negative"
            )
        })
    })
})
