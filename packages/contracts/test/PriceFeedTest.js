
const PriceFeed = artifacts.require("./PriceFeedTester.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockChainlink = artifacts.require("./MockAggregator.sol")
const MockTellor = artifacts.require("./MockTellor.sol")
const TellorCaller = artifacts.require("./TellorCaller.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

contract('PriceFeed', async accounts => {

  const [owner, alice] = accounts;
  let priceFeedTestnet
  let priceFeed
  let zeroAddressPriceFeed
  let mockChainlink

  const setAddresses = async () => {
    await priceFeed.setAddresses(mockChainlink.address, tellorCaller.address, { from: owner })
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

    tellorCaller = await TellorCaller.new(mockTellor.address)
    TellorCaller.setAsDeployed(tellorCaller)

    // Set Chainlink latest and prev round Id's to non-zero
    await mockChainlink.setLatestRoundId(3)
    await mockChainlink.setPrevRoundId(2)

    //Set current and prev prices in both oracles
    await mockChainlink.setPrice(dec(100, 18))
    await mockChainlink.setPrevPrice(dec(100, 18))
    await mockTellor.setPrice(dec(100, 18))

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

  it("C1 Chainlink working: fetchPrice should return the correct price, taking into account the number of decimal digits on the aggregator", async () => {
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
    assert.isTrue(price.eq(toBN(dec(1, 27))))

    // Oracle price is 0.0001
    await mockChainlink.setDecimals(18)
    const decimals = await mockChainlink.decimals()

    await mockChainlink.setPrevPrice(dec(1, 14))
    await mockChainlink.setPrice(dec(1, 14))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    assert.isTrue(price.eq(toBN(dec(1, 14))))

    // Oracle price is 1234.56789
    await mockChainlink.setDecimals(5)
    await mockChainlink.setPrevPrice(dec(123456789))
    await mockChainlink.setPrice(dec(123456789))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    assert.equal(price, '1234567890000000000000')
  })

  // --- Chainlink breaks ---
  it("C1 Chainlink breaks, Tellor working: fetchPrice should return the correct Tellor price, taking into account Tellor's 6-digit granularity", async () => {
    await setAddresses()
    // --- Chainlink fails, system switches to Tellor ---
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 1: using chainlink

    // Chainlink breaks with negative price
    await mockChainlink.setPrevPrice(dec(1, 8))
    await mockChainlink.setPrice("-5000")

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 2: using tellor

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))

    // Tellor price is 10 at 6-digit precision
    await mockTellor.setPrice(dec(10, 6))
    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Liquity PriceFeed gives 10, with 18 digit precision
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

  it("C1 usingChainlink: Chainlink broken by zero latest roundId, Tellor working: switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setLatestRoundId(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("C1 usingChainlink: Chainlink broken by zero latest roundId, Tellor working: use Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setLatestRoundId(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("C1 usingChainlink: Chainlink broken by zero timestamp, Tellor working, switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("C1 usingChainlink:  Chainlink broken by zero timestamp, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C1 usingChainlink: Chainlink broken by future timestamp, Tellor working, switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('1000'))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("C1 usingChainlink: Chainlink broken by future timestamp, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('1000'))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C1 usingChainlink: Chainlink broken by negative price, Tellor working,  switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrice("-5000")

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: Chainlink broken by negative price, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrice("-5000")

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })


  it("C1 usingChainlink: Chainlink broken - decimals call reverted, Tellor working, switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: Chainlink broken - decimals call reverted, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C1 usingChainlink: Chainlink broken - latest round call reverted, Tellor working, switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: latest round call reverted, Tellor working, return the Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C1 usingChainlink: previous round call reverted, Tellor working, switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: previous round call reverted, Tellor working, return Tellor Price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))
    await mockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  // --- Chainlink timeout --- 

  it("C1 usingChainlink: Chainlink times out, Tellor working: switch to usingTellorChainlinkFrozen", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(10800, web3.currentProvider) // fast forward 3 hours
    const now = await th.getLatestBlockTimestamp(web3)

    // Tellor price is recent
    await mockTellor.setUpdateTime(now)
    await mockTellor.setPrice(dec(123, 6))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '3') // status 3: using tellor, chainlink frozen 
  })

  it("C1 usingChainlink: Chainlink frozen, Tellor working: return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    // Tellor price is recent
    await mockTellor.setUpdateTime(now)
    await mockTellor.setPrice(dec(123, 6))

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C1 usingChainlink: Chainlink frozen, Tellor frozen: switch to usingTellorChainlinkFrozen", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(10800, web3.currentProvider) // fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '3') // status 3: using tellor, chainlink frozen 
  })

  it("C1 usingChainlink: Chainlink frozen, Tellor frozen: return last good price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    // Expect lastGoodPrice has not updated
    assert.equal(price, dec(999, 18))
  })

  it("C1 usingChainlink: Chainlink times out, Tellor broken by 0 price: switch to tellorBrokenChainlinkFrozen", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // Tellor breaks by 0 price
    await mockTellor.setPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '4') // status 4: tellor broken, chainlink frozen
  })

  it("C1 usingChainlink: Chainlink times out, Tellor broken by 0 price: return last good price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    await mockTellor.setPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Expect lastGoodPrice has not updated
    assert.equal(price, dec(999, 18))
  })

  it("C1 usingChainlink: Chainlink is out of date by <3hrs: remain usingChainlink", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await th.fastForwardTime(10740, web3.currentProvider) // fast forward 2hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: using chainlink
  })

  it("C1 usingChainlink: Chainlink is out of date by <3hrs: return Chainklink price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    const decimals = await mockChainlink.decimals()

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await th.fastForwardTime(10740, web3.currentProvider) // fast forward 2hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1234, 18))
  })

  // --- Chainlink price deviation ---

  it("C1 usingChainlink: Chainlink price drop of >50%, switch to usingTellor", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: Chainlink price drop of >50%, return the Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203,4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(203, 16))
  })

  it("C1 usingChainlink: Chainlink price drop of 50%, remain usingChainlink", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(1, 8))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: still using chainlink 
  })

  it("C1 usingChainlink: Chainlink price drop of 50%, return the Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(1, 8))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1, 18))
  })

  it("C1 usingChainlink: Chainlink price drop of <50%, remain usingChainlink", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(100000001))   // price drops to 1.00000001:  a drop of < 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: still using chainlink 
  })

  it("C1 usingChainlink: Chainlink price drop of <50%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(100000001)   // price drops to 1.00000001:  a drop of < 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(100000001, 10))
  })

  // Price increase 
  it("C1 usingChainlink: Chainlink price increase of >100%, switch to usingTellor", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(400000001)  // price increases to 4.000000001: an increase of > 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor 
  })

  it("C1 usingChainlink: Chainlink price increase of >100%, return Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(400000001)  // price increases to 4.000000001: an increase of > 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(203, 16))
  })

  it("C1 usingChainlink: Chainlink price increase of 100%, remain usingChainlink", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: using chainlink
  })

  it("C1 usingChainlink: Chainlink price increase of 100%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(4, 18))
  })

  it("C1 usingChainlink: Chainlink price increase of <100%, remain usingChainlink", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: using chainlink
  })

  it("C1 usingChainlink: Chainlink price increase of <100%,  return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(203, 4))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(399999999, 10))
  })
  
  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor price matches: remain usingChainlink", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await mockTellor.setPrice(999999) // Tellor price drops to same value (6 ecimals)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: using chainlink 
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor price matches: return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await mockTellor.setPrice(999999) // Tellor price drops to same value (at 6 decimals)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(99999999, 10))
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor price within 3% of Chainlink: remain usingChainlink", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))
   
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(10, 8))  // price = 10
    await mockChainlink.setPrice(dec(4, 8))  // price drops to 4: a drop of > 50% from previous
    await mockTellor.setPrice(3890000) // Tellor price drops to 3.89: price difference with new Chainlink price is now just under 3%

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: using chainlink 
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor price within 3% of Chainlink: return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink
    
    await mockChainlink.setPrevPrice(dec(10, 8))  // price = 10
    await mockChainlink.setPrice(dec(4, 8))  // price drops to 4: a drop of > 50% from previous
    await mockTellor.setPrice(3890000) // Tellor price drops to 3.89: price difference  with new Chainlink price is now just under 3%

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(4, 18))
  })

  
  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor live but not within 3% of Chainlink: switch to usingTellor", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await mockTellor.setPrice(3880000) // Tellor price 3.88: price difference with new Chainlink price is now > 3%

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 0: using tellor 
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor live but not within 3% of Chainlink: return Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await mockTellor.setPrice(3880000) // Tellor price 3.88: price difference with new Chainlink price is now > 3%

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(388, 16)) // return Tellor price
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor frozen: switch to usingTellor", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await mockTellor.setPrice(3880000) // Tellor price 3.88: price difference with new Chainlink price is now > 3%

    // 3 hours pass with no Tellor updates
    await th.fastForwardTime(10800, web3.currentProvider)

     // check Tellor price timestamp is out of date by > 3 hours
     const now = await th.getLatestBlockTimestamp(web3)
     const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
     assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

     await mockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using tellor
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor frozen: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(1300, 6))
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // 3 hours pass with no Tellor updates
    await th.fastForwardTime(10800, web3.currentProvider)

     // check Tellor price timestamp is out of date by > 3 hours
     const now = await th.getLatestBlockTimestamp(web3)
     const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
     assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

     await mockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is the last good price
    assert.equal(price, dec(1200, 18))
  })

  // --- Chainlink fails and Tellor is broken ---

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by 0 price: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return 0 price
    await mockTellor.setPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles suspect
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by 0 price: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(1300, 6))

    // Make mock Chainlink price deviate too much
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return 0 price
    await mockTellor.setPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    // Make mock Chainlink price deviate too much
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return 0 timestamp
    await mockTellor.setUpdateTime(0)
    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles suspect
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(1300, 6))

    // Make mock Chainlink price deviate too much
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return 0 timestamp
    await mockTellor.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by future timestamp: Pricefeed switches to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    // Make mock Chainlink price deviate too much
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return 0 timestamp
    await mockTellor.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles suspect
  })

  it("C1 usingChainlink: Chainlink price drop of >50% and Tellor is broken by future timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: using chainlink

    await mockTellor.setPrice(dec(1300, 6))

    // Make mock Chainlink price deviate too much
    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    // Make mock Tellor return a future timestamp
    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN("10000"))
    await mockTellor.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  // --- Case 2: Using Tellor ---

  // Using Tellor, Tellor breaks
  it("C2 usingTellor: Tellor breaks by zero price: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await mockTellor.setUpdateTime(now)
    await mockTellor.setPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles suspect
  })

  it("C2 usingTellor: Tellor breaks by zero price: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await mockTellor.setUpdateTime(now)
    await mockTellor.setPrice(0)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellor: Tellor breaks by call reverted: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockTellor.setPrice(dec(999, 6))

    await mockTellor.setRevertRequest()

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles suspect
  })

  it("C2 usingTellor: Tellor breaks by call reverted: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockTellor.setPrice(dec(999, 6))

    await mockTellor.setRevertRequest()
   
    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellor: Tellor breaks by zero timestamp: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockTellor.setPrice(dec(999, 6))

    await mockTellor.setUpdateTime(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles suspect
  })

  it("C2 usingTellor: Tellor breaks by zero timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockTellor.setPrice(dec(999, 6))

    await mockTellor.setUpdateTime(0)
   
    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor freezes
  it("C2 usingTellor: Tellor freezes - remain usingTellor", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await mockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor
  })

  it("C2 usingTellor: Tellor freezes - return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await mockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(246, 18))
  })
  
  // Using Tellor, both Chainlink & Tellor go live

  it("C2 usingTellor: both Tellor and Chainlink are live and <= 3% price difference - switch to usingChainlink", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor
  
    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Chainlink

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: using Chainlink
  })

  it("C2 usingTellor: both Tellor and Chainlink are live and <= 3% price difference - return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor
  
    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Chainlink

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(103, 18))
  })

  it("C2 usingTellor: both Tellor and Chainlink are live and > 3% price difference - remain usingTellor", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor

    await priceFeed.fetchPrice()
   
    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor
  })

  it("C2 usingTellor: both Tellor and Chainlink are live and > 3% price difference - return Tellor price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(100, 18))
  })


  // --- Case 3: Both Oracles suspect

  it("C3 bothOraclesSuspect: both Tellor and Chainlink are live and > 3% price difference remain bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles suspect

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles suspect
  })

  it("C3 bothOraclesSuspect: both Tellor and Chainlink are live and > 3% price difference, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles suspect

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(50, 18))
  })

  it("C3 bothOraclesSuspect: both Tellor and Chainlink are live and <= 3% price difference, switch to usingChainlink", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles suspect

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Tellor

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: using Chainlink
  })

  it("bothOraclesSuspect - both Tellor and Chainlink are live and <= 3% price difference, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles suspect

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Tellor

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(103, 18))
  })

  // --- Case 4 ---
  it("C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, switch to bothOraclesSuspect", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: usng tellor, chainlink frozen

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Both Chainlink and Tellor break with 0 price
    await mockChainlink.setPrice(0)
    await mockTellor.setPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles suspect
  })

  it("C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(2) // status 2: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Both Chainlink and Tellor break with 0 price
    await mockChainlink.setPrice(dec(0))
    await mockTellor.setPrice(dec(0))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, switch to usingTellor", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Chainlink breaks
    await mockChainlink.setPrice(dec(0))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using tellor
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Chainlink breaks
    await mockChainlink.setPrice(dec(0))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Tellor price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, switch to usingTellor", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Chainlink breaks
    await mockChainlink.setPrice(dec(0))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using tellor
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, return Tellor price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))

    // Chainlink breaks
    await mockChainlink.setPrice(dec(0))

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live, switch back to usingChainlink", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: using chainlink
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(999, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor broken, switch to tellorFrozenChainlinkBroken", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    // set tellor broken
    await mockTellor.setPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: chainlink frozen, tellor broken
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor broken, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    // set tellor broken
    await mockTellor.setPrice(0)

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, remain usingTellorChainlinkFrozen", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    // set Tellor to current time
    await mockTellor.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 3)  // status 3: using tellor, chainlink frozn
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, return Tellor price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    // set Tellor to current time
    await mockTellor.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(123, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, remain usingTellorChainlinkFrozen", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

     // check Tellor price timestamp is out of date by > 3 hours
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 3)  // status 3: using tellor, chainlink frozn
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

     // check Tellor price timestamp is out of date by > 3 hours
    const tellorUpdateTime = await mockTellor.getTimestampbyRequestIDandIndex(0, 0)
    assert.isTrue(tellorUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  // --- Case 5 ---
  it("C5 tellorBrokenChainlinkFrozen: when Chainlink is live, switch to usingChainlink", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: using Chainlink
  })

  it("C5 tellorBrokenChainlinkFrozen: when Chainlink is live, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(999, 18))
  })

  it("C5 tellorBrokenChainlinkFrozen: when Chainlink frozen, remain on tellorBrokenChainlinkFrozen", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
   
    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))


    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: chainlink broken, tellor frozen
  })

  it("C5 tellorBrokenChainlinkFrozen: when Chainlink frozen, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))


    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })

  it("C5 tellorBrokenChainlinkFrozen: when Chainlink breaks too, switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: bothOraclesSuspect
  })

  it("C5 tellorBrokenChainlinkFrozen: Chainlink breaks too, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: chainlink broken, tellor frozen

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })

  // --- Case 6 - using Chainlink, Tellor broken ---

  it("C6 usingChainlinkTellorBroken: when Chainlink breaks too, switch to bothOraclesSuspect", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: bothOraclesSuspect
  })

  it("C6 usingChainlinkTellorBroken: when Chainlink breaks too, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))
    await mockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await mockTellor.setPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C6 usingChainlinkTellorBroken: when Chainlink freezes, remaind usingChainlinkTellorBroken", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await mockTellor.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 5)  // status 5: using chainlink, tellor is broken
  })

  it("C6 usingChainlinkTellorBroken: when Chainlink freezes, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockChainlink.setPrevPrice(dec(999, 8))
    await mockChainlink.setPrice(dec(999, 8))

    await mockTellor.setPrice(dec(123, 6))

    await th.fastForwardTime(11800, web3.currentProvider) // Fast forward 3 hours

    // check Chainlink price timestamp is out of date by > 3 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const chainlinkUpdateTime = (await mockChainlink.latestRoundData())[3] 
    assert.isTrue(chainlinkUpdateTime.lt(toBN(now).sub(toBN(10800))))

    await mockTellor.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C6 usingChainlinkTellorBroken: both Tellor and Chainlink are live and <= 3% price difference, switch to usingChainlink", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Tellor
    
    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: using Chainlink
  })

  it("C6 usingChainlinkTellorBroken: both Tellor and Chainlink are live and <= 3% price difference, return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice(dec(103, 8)) // price = 103: 3% difference from Tellor
    
    await priceFeed.fetchPrice()

    // Uses latest Chainlink price
    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(103, 18))
  })

  it("C6 usingChainlinkTellorBroken: when Chainlink and Tellor are live but dissimilar price, remain usingChainlinkTellorBroken", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 5) 
  })

  it("C6 usingChainlinkTellorBroken: when Chainlink and Tellor are live but dissimilar price, return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setStatus(5) // status 5: using Chainlink, Tellor is broken

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await mockTellor.setPrice(dec(100, 6)) // price = 100
    await mockChainlink.setPrice('10300000001') // price = 103.00000001: > 3% difference from Tellor
    
    await priceFeed.fetchPrice()

    // Uses latest Chainlink price
    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec('10300000001', 10))
  })
})

