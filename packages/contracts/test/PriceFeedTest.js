
const PriceFeed = artifacts.require("./PriceFeed.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockChainlink = artifacts.require("./MockAggregator.sol")
const MockTellor = artifacts.require("./MockTellor.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

contract('PriceFeed', async accounts => {

  const [owner, alice] = accounts;
  let priceFeedTestnet
  let priceFeed
  let zeroAddressPriceFeed
  let mockChainlink

  const setAddresses = async ()  => {
    await priceFeed.setAddresses(mockChainlink.address, mockTellor.address, { from: owner })
  }

  beforeEach(async () => {
    priceFeedTestnet = await PriceFeedTestnet.new()
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

    priceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(priceFeed)

    zeroAddressPriceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(zeroAddressPriceFeed)

    mockChainlink = await MockChainlink.new()
    MockChainlink.setAsDeployed(mockChainlink)

    mockTellor = await MockTellor.new()
    MockTellor.setAsDeployed(mockTellor)

    // Set mock price updateTimes in both oracles to very recent
    const now = await th.getLatestBlockTimestamp(web3)
    await mockChainlink.setUpdateTime(now)
    await mockTellor.setUpdateTime(now)
  })

  describe('PriceFeed internal testing contract', async accounts => {
    it("fetchPrice before setPrice should return the default price", async () => {
      const price = await priceFeedTestnet.getPrice()
      assert.equal(price, dec(200, 18))
    })
    it("should be able to fetchPrice after setPrice, output of former matching input of latter", async () => {
      await priceFeedTestnet.setPrice(dec(100, 18))
      const price = await priceFeedTestnet.getPrice()
      assert.equal(price, dec(100, 18))
    })
  })

  describe('Mainnet PriceFeed setup', async accounts => {
    it("fetchPrice should fail on contract with no chainlink address set", async () => {
      try {
        const price = await zeroAddressPriceFeed.fetchPrice()
        assert.isFalse(price.receipt.status)
      } catch (err) {
        assert.include(err.message, "function call to a non-contract account")
      }
    })

    it("fetchPrice should fail on contract with no tellor address set", async () => {
      try {
        const price = await zeroAddressPriceFeed.fetchPrice()
        assert.isFalse(price.receipt.status)
      } catch (err) {
        assert.include(err.message, "function call to a non-contract account")
      }
    })

    it("setAddresses should fail whe called by nonOwner", async () => {
      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, mockTellor.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })

    it("setAddresses should fail after address has already been set", async () => {
      // Owner can successfully set any address
      const txOwner = await priceFeed.setAddresses(mockChainlink.address, mockTellor.address, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, mockTellor.address, { from: owner }),
        "Ownable: caller is not the owner"
      )

      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, mockTellor.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })
  })

  it("Chainlink working: fetchPrice should return the correct price, taking into account the number of decimal digits on the aggregator", async () => {
    await setAddresses()

    // Oracle price price is 10.00000000
    await mockChainlink.setDecimals(8)
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(1, 9))
    await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 10, with 18 digit precision
    assert.equal(price, dec(10, 18))

    // Oracle price is 1e9
    await mockChainlink.setDecimals(0)
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(1, 9))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 1e9, with 18 digit precision
    assert.equal(price, dec(1, 27))

    // Oracle price is 0.0001
    await mockChainlink.setDecimals(18)
    await mockChainlink.setPrevPrice(dec(1, 14))
    await mockChainlink.setPrice(dec(1, 14))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    price = await priceFeed.fetchPrice()
    assert.equal(price, dec(1, 14))

    // Oracle price is 1234.56789
    await mockChainlink.setDecimals(5)
    await mockChainlink.setPrevPrice(dec(123456789))
    await mockChainlink.setPrice(dec(123456789))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    price = await priceFeed.fetchPrice()
    assert.equal(price, '1234567890000000000000')
  })

  it("Chainlink failed, Tellor working: fetchPrice should return the correct Tellor price, taking into account Tellor's 6-digit granularity", async () => {
    await setAddresses()
    // --- Chainlink fails, system switches to Tellor ---
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 1: using chainlink
   
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 2: using tellor

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123,  18))
    
    // Tellor price is 10 at 6-digit precision
    await mockTellor.setPrice(dec(10, 6))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 10, with 18 digit precision
    console.log(`${price}`)
    console.log(dec(10, 18))
    assert.equal(price, dec(10, 18))

    // Tellor price is 1e9 at 6-digit precision
    await mockTellor.setPrice(dec(1, 15))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 1e9, with 18 digit precision
    assert.equal(price, dec(1, 27))

    // Tellor price is 0.0001 at 6-digit precision
    await mockTellor.setPrice(100)
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    
    assert.equal(price, dec(1, 14))

    // Tellor price is 1234.56789 at 6-digit precision
    await mockTellor.setPrice(dec(1234567890))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    assert.equal(price, '1234567890000000000000')
  })

  it("Chainlink failed by zero timestamp, Tellor working: PriceFeed should switch to Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
   
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("Chainlink failed by zero timestamp, Tellor working: PriceFeed should use the Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
   
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
   
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123,  18))
  })

  it("Chainlink failed by future timestamp, Tellor working: fetchPrice should switch to Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
   
    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('1000'))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("Chainlink failed by future timestamp, Tellor working: fetchPrice should use the Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
   
    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('1000'))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123,  18))
  })

  it("Chainlink failed by negative price, Tellor working: fetchPrice should switch to Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrice("-5000")

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("Chainlink failed by negative price, Tellor working: fetchPrice should return the correct price from Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrice("-5000")

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123,  18))
  })

  it.only("Price deviation of 50% doesn't cause PriceFeed to switch to fallback", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevPrice(dec(2, 9))
    await mockChainlink.setPrice(dec(3, 9))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("Price deviation of >50% causes PriceFeed to switch to fallback", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevPrice(dec(2, 9))
    await mockChainlink.setPrice(dec(4, 9))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("Price deviation of <50% doesn't cause PriceFeed to switch to fallback", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevPrice(dec(2, 9))
    await mockChainlink.setPrice(dec(2999999999))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: still using chainlink 
  })

  it("Chainlink failed by large relative price deviation, Tellor working: fetchPrice should switch to Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(2, 9))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter =  await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("Chainlink failed by large relative price deviation, Tellor working: fetchPrice should return the correct price from Tellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(2, 9))

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123,  18))
  })
})

