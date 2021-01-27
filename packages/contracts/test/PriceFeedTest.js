
const PriceFeed = artifacts.require("./PriceFeed.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockAggregator = artifacts.require("./MockAggregator.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

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

        // Set mock price updateTime to way in the past
        await mockAggregator.setUpdateTime(1)
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

        it("setAddresses should fail after address has already been set", async () => {
            // Owner can successfully set any address
            const txOwner = await priceFeed.setAddresses(mockAggregator.address, { from: owner })
            assert.isTrue(txOwner.receipt.status)      
            
            await assertRevert(
                priceFeed.setAddresses(mockAggregator.address, { from: owner }),
                "Ownable: caller is not the owner"    
            )

            await assertRevert(
                priceFeed.setAddresses(mockAggregator.address, { from: alice }),
                "Ownable: caller is not the owner"    
            )
        })

        it("getPrice should return the correct price, taking into account the number of decimal digits on the aggregator", async () => {
            // Oracle price price is 10.00000000
            await mockAggregator.setDecimals(8) 
            await mockAggregator.setPrice(dec(1, 9))
            let price = await priceFeed.getPrice()
            // Check Liquity PriceFeed gives 10, with 18 digit precision
            assert.equal(price, dec(10, 18))

            // Oracle price is 1e9
            await mockAggregator.setDecimals(0) 
            await mockAggregator.setPrice(dec(1, 9))
            price = await priceFeed.getPrice()
            // Check Liquity PriceFeed gives 1e9, with 18 digit precision
            assert.equal(price, dec(1, 27))
           
            // Oracle price is 0.0001
            await mockAggregator.setDecimals(18) 
            await mockAggregator.setPrice(dec(1, 14))
            price = await priceFeed.getPrice()
            // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
            price = await priceFeed.getPrice()
            assert.equal(price, dec(1, 14))

            // Oracle price is 1234.56789
            await mockAggregator.setDecimals(5) 
            await mockAggregator.setPrice(dec(123456789))
            price = await priceFeed.getPrice()
            // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
            price = await priceFeed.getPrice()
            assert.equal(price, '1234567890000000000000')
        })

        it("getPrice should revert with zero timestamp", async () => {
            await mockAggregator.setUpdateTime(0) // Sets 
            await assertRevert(
                priceFeed.getPrice(),
                "PriceFeed: price timestamp from aggregator is 0, or in future"
            )
        })

        it("getPrice should revert with future timestamp", async () => {
            const now = await th.getLatestBlockTimestamp(web3)
            const future = toBN(now).add(toBN('1000'))

            await mockAggregator.setUpdateTime(future)
            await assertRevert(
                priceFeed.getPrice(),
                "PriceFeed: price timestamp from aggregator is 0, or in future"
            )
        })

        it("getPrice should revert with negative price", async () => {
            await mockAggregator.setPrice("-5000")  
            await assertRevert(
                priceFeed.getPrice(),
                "PriceFeed: price answer from aggregator is negative"
            )
        })
    })
})
