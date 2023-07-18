const PriceFeed = artifacts.require("./PriceFeedTester.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockChainlink = artifacts.require("./MockAggregator.sol")
const MockTellor = artifacts.require("./MockTellor.sol")
const BrokenMockTellor = artifacts.require("./MockTellor.sol")
const TellorCaller = artifacts.require("./TellorCaller.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

const abiCoder = new ethers.utils.AbiCoder();

const ethUsdQueryDataArgs = abiCoder.encode(["string", "string"], ["eth", "usd"]);
const ethUsdQueryData = abiCoder.encode(["string", "bytes"], ["SpotPrice", ethUsdQueryDataArgs]);
const ethUsdQueryId = ethers.utils.keccak256(ethUsdQueryData);

const brlUsdQueryDataArgs = abiCoder.encode(["string", "string"], ["brl", "usd"]);
const brlUsdQueryData = abiCoder.encode(["string", "bytes"], ["SpotPrice", brlUsdQueryDataArgs]);
const brlUsdQueryId = ethers.utils.keccak256(brlUsdQueryData);

const tellorDigits = 6

contract('PriceFeed', async accounts => {

  const [owner, alice] = accounts;
  let priceFeedTestnet
  let priceFeed
  let zeroAddressPriceFeed
  let ethUsdMockChainlink
  let brlUsdMockChainlink

  const setAddresses = async () => {
    await priceFeed.setAddresses(brlUsdMockChainlink.address, ethUsdMockChainlink.address, brlUsdTellorCaller.address, ethUsdTellorCaller.address, { from: owner })
  }

  async function setBrlUsdTellorPrice(price) {
    let valueBytes = abiCoder.encode(["uint256"], [price]);
    await brlUsdMockTellor.submitValue(brlUsdQueryId, valueBytes, 0, brlUsdQueryData)
    await th.fastForwardTime(15 * 60 + 1, web3.currentProvider) // 15 minutes
  }

  async function setEthUsdTellorPrice(price) {
    let valueBytes = abiCoder.encode(["uint256"], [price]);
    await ethUsdMockTellor.submitValue(ethUsdQueryId, valueBytes, 0, ethUsdQueryData)
    await th.fastForwardTime(15 * 60 + 1, web3.currentProvider) // 15 minutes
  }

  beforeEach(async () => {
    priceFeedTestnet = await PriceFeedTestnet.new(tellorDigits)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

    priceFeed = await PriceFeed.new(tellorDigits)
    PriceFeed.setAsDeployed(priceFeed)

    zeroAddressPriceFeed = await PriceFeed.new(tellorDigits)
    PriceFeed.setAsDeployed(zeroAddressPriceFeed)

    brlUsdMockChainlink = await MockChainlink.new()
    MockChainlink.setAsDeployed(brlUsdMockChainlink)

    ethUsdMockChainlink = await MockChainlink.new()
    MockChainlink.setAsDeployed(ethUsdMockChainlink)

    ethUsdMockTellor = await MockTellor.new(ethUsdQueryData)
    MockTellor.setAsDeployed(ethUsdMockTellor)

    brlUsdMockTellor = await MockTellor.new(brlUsdQueryData)
    MockTellor.setAsDeployed(brlUsdMockTellor)

    ethUsdTellorCaller = await TellorCaller.new(ethUsdMockTellor.address, ethUsdQueryId)
    TellorCaller.setAsDeployed(ethUsdTellorCaller)

    brlUsdTellorCaller = await TellorCaller.new(brlUsdMockTellor.address, brlUsdQueryId)
    TellorCaller.setAsDeployed(brlUsdTellorCaller)

    // Set ETH : USD Chainlink latest and prev round Id's to non-zero
    await ethUsdMockChainlink.setLatestRoundId(3)
    await ethUsdMockChainlink.setPrevRoundId(2)

    // Set BRL : USD Chainlink latest and prev round Id's to non-zero
    await brlUsdMockChainlink.setLatestRoundId(3)
    await brlUsdMockChainlink.setPrevRoundId(2)

    //Set current and prev prices in both oracles
    await ethUsdMockChainlink.setPrice(dec(100, 18))
    await ethUsdMockChainlink.setPrevPrice(dec(100, 18))
    await brlUsdMockChainlink.setPrice(dec(100, 18))
    await brlUsdMockChainlink.setPrevPrice(dec(100, 18))
    await setEthUsdTellorPrice(dec(100, 18))
    await setBrlUsdTellorPrice(dec(100, 18))

    // Set mock price updateTimes in both oracles to very recent
    const now = await th.getLatestBlockTimestamp(web3)
    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)
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
        assert.include(err.message, "Transaction reverted: function returned an unexpected amount of data")
      }
    })

    it("fetchPrice should fail on contract with no tellor address set", async () => {
      try {
        const price = await zeroAddressPriceFeed.fetchPrice()
        assert.isFalse(price.receipt.status)
      } catch (err) {
        assert.include(err.message, "Transaction reverted: function returned an unexpected amount of data")
      }
    })

    it("setAddresses should fail whe called by nonOwner", async () => {
      await assertRevert(
        priceFeed.setAddresses(brlUsdMockChainlink.address, ethUsdMockChainlink.address, brlUsdMockTellor.address, ethUsdMockTellor.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })

    it("setAddresses should fail after address has already been set", async () => {
      // Owner can successfully set any address
      const txOwner = await priceFeed.setAddresses(brlUsdMockChainlink.address, ethUsdMockChainlink.address,  brlUsdMockTellor.address, ethUsdMockTellor.address, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      await assertRevert(
        priceFeed.setAddresses(brlUsdMockChainlink.address, ethUsdMockChainlink.address, brlUsdMockTellor.address, ethUsdMockTellor.address, { from: owner }),
        "PriceFeed: contacts already set"
      )

      await assertRevert(
        priceFeed.setAddresses(brlUsdMockChainlink.address, ethUsdMockChainlink.address, brlUsdMockTellor.address, ethUsdMockTellor.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })
  })

  it("C1 Chainlink working: fetchPrice should return the correct price, taking into account the number of decimal digits on the aggregator", async () => {
    await setAddresses()

    // ETH : USD Oracle price price is 20.00000000
    await ethUsdMockChainlink.setDecimals(8)
    await ethUsdMockChainlink.setPrevPrice(dec(2, 9))
    await ethUsdMockChainlink.setPrice(dec(2, 9))

    // BRL : USD Oracle price price is 10.00000000
    await brlUsdMockChainlink.setDecimals(8)
    await brlUsdMockChainlink.setPrevPrice(dec(1, 9))
    await brlUsdMockChainlink.setPrice(dec(1, 9))

    await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 10, with 18 digit precision
    assert.equal(price, dec(2, 18))

    // ETH : USD Oracle price is 2e9
    await ethUsdMockChainlink.setDecimals(0)
    await ethUsdMockChainlink.setPrevPrice(dec(2, 9))
    await ethUsdMockChainlink.setPrice(dec(2, 9))

    // BRL : USD Oracle price is 1e9
    await brlUsdMockChainlink.setDecimals(0)
    await brlUsdMockChainlink.setPrevPrice(dec(1, 9))
    await brlUsdMockChainlink.setPrice(dec(1, 9))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 2e8, with 18 digit precision
    assert.isTrue(price.eq(toBN(dec(2, 18))))

    // ETH : USD Oracle price is 0.0002
    await ethUsdMockChainlink.setDecimals(18)
    const ethUsdDecimals = await ethUsdMockChainlink.decimals()
    await ethUsdMockChainlink.setPrevPrice(dec(2, 14))
    await ethUsdMockChainlink.setPrice(dec(2, 14))

    // BRL : USD Oracle price is 0.001
    await brlUsdMockChainlink.setDecimals(18)
    const brlUsdDecimals = await brlUsdMockChainlink.decimals()
    await brlUsdMockChainlink.setPrevPrice(dec(1, 15))
    await brlUsdMockChainlink.setPrice(dec(1, 15))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 0.2 with 18 digit precision
    assert.isTrue(price.eq(toBN(dec(2, 17))))

    // ETH : USD Oracle price is 9876.54321
    await ethUsdMockChainlink.setDecimals(5)
    await ethUsdMockChainlink.setPrevPrice(dec(987654321))
    await ethUsdMockChainlink.setPrice(dec(987654321))

    // BRL : USD Oracle price is 1234.56789
    await brlUsdMockChainlink.setDecimals(5)
    await brlUsdMockChainlink.setPrevPrice(dec(123456789))
    await brlUsdMockChainlink.setPrice(dec(123456789))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 0.0001 with 18 digit precision
    assert.equal(price, '8000000072900000663')
  })

  // --- Chainlink breaks ---
  it("C1 Chainlink breaks, Tellor working: fetchPrice should return the correct Tellor price, taking into account Tellor's 6-digit granularity", async () => {
    await setAddresses()
    // --- Chainlink fails, system switches to Tellor ---
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    // Chainlink breaks with negative price
    await ethUsdMockChainlink.setPrevPrice(dec(1, 8))
    await ethUsdMockChainlink.setPrice("-5000")
    await brlUsdMockChainlink.setPrevPrice(dec(1, 8))
    await brlUsdMockChainlink.setPrice("1000")

    await setEthUsdTellorPrice(dec(500, 6))
    await setBrlUsdTellorPrice(dec(10, 6))

    await ethUsdMockChainlink.setUpdateTime(0)
    await brlUsdMockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))

    // ETH : USD Tellor price is 10 at 6-digit precision
    await setEthUsdTellorPrice(dec(10, 6))

    // BRL : USD Tellor price is 2 at 6-digit precision
    await setBrlUsdTellorPrice(dec(2, 6))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 5, with 18 digit precision (10 / 2)
    assert.equal(price, dec(5, 18))

    // ETH : USD Tellor price is 2e9 at 6-digit precision
    await setEthUsdTellorPrice(dec(2, 15))

    // BRL : USD Tellor price is 1e8 at 6-digit precision
    await setBrlUsdTellorPrice(dec(1, 14))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 10 with 18 digit precision
    assert.equal(price, dec(2, 19))

    // Tellor price is 0.0001 at 6-digit precision
    await setEthUsdTellorPrice(100)

    // Tellor price is 0.00002 at 6-digit precision
    await setBrlUsdTellorPrice(20)

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 0.0001 with 18 digit precision

    assert.equal(price, dec(5, 18))

    // Tellor ETH / USD price is 9876.54321 at 6-digit precision
    await setEthUsdTellorPrice(dec(9876543210))

    // Tellor BRL / USD price is 1234.56789 at 6-digit precision
    await setBrlUsdTellorPrice(dec(1234567890))

    await priceFeed.fetchPrice()
    price = await priceFeed.lastGoodPrice()
    // Check Stabilio PriceFeed gives 0.0001 with 18 digit precision
    assert.equal(price, '8000000072900000663')
  })

  it("C1 chainlinkWorking: Chainlink broken by zero latest roundId, Tellor working: switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(123, 5))
    await setBrlUsdTellorPrice(dec(123, 5))

    await ethUsdMockChainlink.setLatestRoundId(0)
    await brlUsdMockChainlink.setLatestRoundId(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken by zero latest roundId, Tellor working: use Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(123, 5))
    await setBrlUsdTellorPrice(dec(123, 5))

    await ethUsdMockChainlink.setLatestRoundId(0)
    await brlUsdMockChainlink.setLatestRoundId(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken by zero timestamp, Tellor working, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(123, 5))
    await setBrlUsdTellorPrice(dec(123, 5))

    await ethUsdMockChainlink.setUpdateTime(0)
    await brlUsdMockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking:  Chainlink broken by zero timestamp, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6000, 6))
    await setBrlUsdTellorPrice(dec(120, 6))

    await ethUsdMockChainlink.setUpdateTime(0)
    await brlUsdMockChainlink.setUpdateTime(0)

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C1 chainlinkWorking: Chainlink broken by future timestamp, Tellor working, switch to usingTellorChainlinkUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await priceFeed.setLastGoodPrice(dec(999, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('10000'))

    await setEthUsdTellorPrice(dec(6000, 6))
    await setBrlUsdTellorPrice(dec(120, 6))

    await ethUsdMockChainlink.setUpdateTime(future)
    await brlUsdMockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken by future timestamp, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await priceFeed.setLastGoodPrice(dec(999, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    const future = toBN(now).add(toBN('10000'))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setUpdateTime(future)

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink broken by negative price, Tellor working, switch to usingTellorChainlinkUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice("-5000")

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken by negative price, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice("-5000")
    await brlUsdMockChainlink.setPrevPrice(dec(999, 8))

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, switch to usingTellorChainlinkUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, switch to usingTellorChainlinkUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setDecimalsRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink broken - latest round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink broken - latest round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: latest round call reverted, Tellor working, return the Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: latest round call reverted, Tellor working, return the Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setLatestRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: previous round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: previous round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: previous round call reverted, Tellor working, return Tellor Price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: previous round call reverted, Tellor working, return Tellor Price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await brlUsdMockChainlink.setPrevRevert()

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  // --- Chainlink timeout --- 

  it("C1 chainlinkWorking: Chainlink frozen, Tellor working: switch to usingTellorChainlinkFrozen", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours
    const now = await th.getLatestBlockTimestamp(web3)

    // Tellor price is recent
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '3') // status 3: using Tellor, Chainlink frozen 
  })

  it("C1 chainlinkWorking: Chainlink frozen, Tellor working: return Tellor price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours
    const now = await th.getLatestBlockTimestamp(web3)

    // Tellor price is recent
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink frozen, Tellor frozen: switch to usingTellorChainlinkFrozen", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours

    // check Tellor price timestamp is out of date by > 4 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '3') // status 3: using Tellor, Chainlink frozen
  })

  it("C1 chainlinkWorking: Chainlink frozen, Tellor frozen: return last good price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 4 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    // Expect lastGoodPrice has not updated
    assert.equal(price, dec(999, 18))
  })

  it("C1 chainlinkWorking: Chainlink times out, Tellor broken by 0 price: switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 4 hours

    // Tellor breaks by 0 price
    await setEthUsdTellorPrice(dec(0, 0))
    await setBrlUsdTellorPrice(dec(0, 0))

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '4') // status 4: using Chainlink, Tellor untrusted
  })

  it("C1 chainlinkWorking: Chainlink times out, Tellor broken by 0 price: return last good price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    await priceFeed.setLastGoodPrice(dec(999, 18))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 4 hours

    // Tellor breaks by 0 price
    await setEthUsdTellorPrice(dec(28, 6))
    await setBrlUsdTellorPrice(dec(0, 0))

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Expect lastGoodPrice has not updated
    assert.equal(price, dec(999, 18))
  })

  it("C1 chainlinkWorking: Chainlink is out of date by <7hrs: remain chainlinkWorking", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await th.fastForwardTime(28740, web3.currentProvider) // fast forward 7hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink is out of date by <7hrs: return Chainklink price", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    const decimals = await ethUsdMockChainlink.decimals()

    await ethUsdMockChainlink.setPrevPrice(dec(99, 19))
    await ethUsdMockChainlink.setPrice(dec(99, 19))

    await brlUsdMockChainlink.setPrevPrice(dec(9, 19))
    await brlUsdMockChainlink.setPrice(dec(9, 19))

    await th.fastForwardTime(28740, web3.currentProvider) // fast forward 7hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(11, 18))
  })

  // --- Chainlink price deviation ---

  it("C1 chainlinkWorking: Chainlink price drop of >50%, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50%, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50%, return the Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50%, return the Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink price drop of 50%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(1, 8))  // price drops to 1

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(1, 8))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of 50%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))

    await ethUsdMockChainlink.setPrevPrice(dec(4, 19))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(2, 19))  // price drops to 2

    await brlUsdMockChainlink.setPrevPrice(dec(2, 19))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(1, 19))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(2, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of <50%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(4, 19))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(3, 19))  // price drops to 3

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(100000001))  // price drops to 1.00000001:  a drop of < 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working 
  })

  it("C1 chainlinkWorking: Chainlink price drop of <50%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(200000001))  // price drops to 2.00000001:  a drop of < 50% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price drops to 2

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working 
  })

  it("C1 chainlinkWorking: Chainlink price drop of <50%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(200000001))  // price drops to 2.00000001:  a drop of < 50% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price drops to 2

    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1000000005, 9))
  })

  // Price increase 
  it("C1 chainlinkWorking: Chainlink price increase of >100%, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(400000001))  // price increases to 4.000000001: an increase of > 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await brlUsdMockChainlink.setPrice(dec(3, 8))  // price = 3

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  // Price increase 
  it("C1 chainlinkWorking: Chainlink price increase of >100%, switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await ethUsdMockChainlink.setPrice(dec(3, 8))  // price = 3

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(400000001))  // price increases to 4.000000001: an increase of > 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink price increase of >100%, return Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(400000001))  // price increases to 4.000000001: an increase of > 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await brlUsdMockChainlink.setPrice(dec(3, 8))  // price = 3

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink price increase of >100%, return Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 3
    await ethUsdMockChainlink.setPrice(dec(3, 8))  // price = 3

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(400000001))  // price increases to 4.000000001: an increase of > 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(5, 19))
  })

  it("C1 chainlinkWorking: Chainlink price increase of 100%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of 100%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(3, 8))  // price = 3

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of 100%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(3, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(6, 8))  // price increases to 6: an increase of 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(1, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price increases to 2: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(3, 18))
  })

  it("C1 chainlinkWorking: Chainlink price increase of <100%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(1, 8))  // price = 1
    await brlUsdMockChainlink.setPrice(dec(1, 8))  // price = 1

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of <100%, remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(1, 8))  // price = 1
    await ethUsdMockChainlink.setPrice(dec(1, 8))  // price = 1

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of <100%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await setEthUsdTellorPrice(dec(6, 9))
    await setBrlUsdTellorPrice(dec(12, 7))
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(100000001))  // price = 1.00000001
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price increases to 2: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1999999995, 9))
  })
  
  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price matches: remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(dec(2, 8))  // price = 2
    await setEthUsdTellorPrice(999999) // Tellor price drops to same value (6 decimals)
    await setBrlUsdTellorPrice(dec(2, 6)) // price = 2

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price matches: remain chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await ethUsdMockChainlink.setPrice(dec(2, 8))  // price = 2

    await brlUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await setEthUsdTellorPrice(dec(2, 6)) // price = 2
    await setBrlUsdTellorPrice(999999) // Tellor price drops to same value (6 decimals)

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price matches: return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await ethUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 2
    await brlUsdMockChainlink.setPrice(199999999)  // price drops to 1.99999999: a drop of > 50% from previous
    await setEthUsdTellorPrice(dec(4, 6)) // price = 2
    await setBrlUsdTellorPrice(1999999) // Tellor price drops to same value (6 decimals)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, '2000000010000000050')
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: remain chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))
   
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(104999999) // Tellor price drops to 104.99: price difference with new Chainlink price is now just under 5%
    await setBrlUsdTellorPrice(dec(4, 6)) // price = 4

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: remain chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))
   
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(400, 8))  // price = 400
    await ethUsdMockChainlink.setPrice(dec(400, 8))  // price = 400
    await brlUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await brlUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous

    await setEthUsdTellorPrice(dec(4, 8)) // price = 400
    await setBrlUsdTellorPrice(104999999) // Tellor price drops to 104.99: price difference with new Chainlink price is now just under 5%

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working
    
    await ethUsdMockChainlink.setPrevPrice(dec(400, 8))  // price = 400
    await ethUsdMockChainlink.setPrice(dec(400, 8))  // price = 400
    await brlUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await brlUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous

    await setEthUsdTellorPrice(dec(4, 8)) // price = 400
    await setBrlUsdTellorPrice(104999999) // Tellor price drops to 104.99: price difference with new Chainlink price is now just under 5%

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(4, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: remain chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18))
   
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(104999999) // Tellor price drops to 104.99: price difference with new Chainlink price is now just under 5%
    await setBrlUsdTellorPrice(dec(4, 6)) // price = 4

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(25, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor live but not within 5% of Chainlink: switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(105000001) // Tellor price drops to 105.000001: price difference with new Chainlink price is now > 5%
    await setBrlUsdTellorPrice(dec(4, 6)) // price = 4

    const priceFetchTx = await priceFeed.fetchPrice()
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor live but not within 5% of Chainlink: return Tellor price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(2, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(105000001) // Tellor price drops to 105.000001: price difference with new Chainlink price is now > 5%
    await setBrlUsdTellorPrice(dec(4, 7)) // price = 40

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(2625000025, 9)) // return Tellor price
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor frozen: switch to usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(dec(100, 8))
    await setBrlUsdTellorPrice(dec(100, 8))

    // 8 hours pass with no Tellor updates
    await th.fastForwardTime(28800, web3.currentProvider)

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '1') // status 1: using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor frozen: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(1000, 8))  // prev price = 1000
    await ethUsdMockChainlink.setPrice(dec(100, 8))  // price drops to 100: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    await setEthUsdTellorPrice(dec(100, 8))
    await setBrlUsdTellorPrice(dec(100, 8))

    // 8 hours pass with no Tellor updates
    await th.fastForwardTime(28800, web3.currentProvider)

     // check Tellor price timestamp is out of date by > 8 hours
     const now = await th.getLatestBlockTimestamp(web3)
     const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
     assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

     await ethUsdMockChainlink.setUpdateTime(now)
     await brlUsdMockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is the last good price
    assert.equal(price, dec(1200, 18))
  })

  // --- Chainlink fails and Tellor is broken ---

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make ETH / USD mock Tellor return 0 price
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(100, 8))

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make BRL / USD mock Tellor return 0 price
    await setEthUsdTellorPrice(dec(100, 8))
    await setBrlUsdTellorPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make ETH / USD mock Tellor return 0 price
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(100, 8))

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make BRL / USD mock Tellor return 0 price
    await setEthUsdTellorPrice(dec(100, 8))
    await setBrlUsdTellorPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    // Make mock Chainlink price deviate too much
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make ETH / USD mock Tellor return 0 timestamp
    await ethUsdMockTellor.setUpdateTime(0)
    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: switch to bothOracleSuspect", async () => {
    await setAddresses()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    // Make mock Chainlink price deviate too much
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make BRL / USD mock Tellor return 0 timestamp
    await brlUsdMockTellor.setUpdateTime(0)
    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '2') // status 2: both oracles untrusted
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    // Make mock Chainlink price deviate too much
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make ETH / USD mock Tellor return 0 timestamp
    await ethUsdMockTellor.setUpdateTime(0)
    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) // establish a "last good price" from the previous price fetch

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    // Make mock Chainlink price deviate too much
    await ethUsdMockChainlink.setPrevPrice(dec(2, 8))  // price = 
    await ethUsdMockChainlink.setPrice(99999999)  // price drops to 0.99999999: a drop of > 50% from previous
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))  // price = 4
    await brlUsdMockChainlink.setPrice(dec(4, 8))  // price = 4

    // Make BRL / USD mock Tellor return 0 timestamp
    await brlUsdMockTellor.setUpdateTime(0)
    const priceFetchTx = await priceFeed.fetchPrice()

    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is in fact the previous price
    assert.equal(price, dec(1200, 18))
  })

  // -- Chainlink is working 
  it("C1 chainlinkWorking: Chainlink is working and Tellor is working - remain on chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(103, 18))
    await setBrlUsdTellorPrice(dec(13, 18))

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor is working - return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(103, 18))
    await setBrlUsdTellorPrice(dec(13, 18))

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is current Chainlink price
    assert.equal(price, dec(255, 17))
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor freezes - remain on chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(103, 18))
    await setBrlUsdTellorPrice(dec(13, 18))

    // 8 hours pass with no Tellor updates
    await th.fastForwardTime(28800, web3.currentProvider)

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

     // Chainlink's prices are current
    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()

    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor freezes - return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(103, 18))
    await setBrlUsdTellorPrice(dec(13, 18))

    // 8 hours pass with no Tellor updates
    await th.fastForwardTime(28800, web3.currentProvider)

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

     // Chainlink's prices are current
    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is current Chainlink price
    assert.equal(price, dec(255, 17))
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor breaks: switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(13, 18))

    const priceFetchTx = await priceFeed.fetchPrice()
  
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '4') // status 4: Using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor breaks: switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(13, 18))
    await setBrlUsdTellorPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
  
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '4') // status 4: Using Tellor, Chainlink untrusted
  })

  it("C1 chainlinkWorking: Chainlink is working and Tellor breaks: return Chainlink price", async () => { 
    await setAddresses()
    priceFeed.setLastGoodPrice(dec(1200, 18)) 

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await ethUsdMockChainlink.setPrevPrice(dec(101, 8))
    await ethUsdMockChainlink.setPrice(dec(102, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(4, 8))
    await brlUsdMockChainlink.setPrice(dec(4, 8))

    await setEthUsdTellorPrice(dec(13, 18))
    await setBrlUsdTellorPrice(0)

    const priceFetchTx = await priceFeed.fetchPrice()
    let price = await priceFeed.lastGoodPrice()

    // Check that the returned price is current Chainlink price
    assert.equal(price, dec(255, 17))
  })

  // --- Case 2: Using Tellor ---

  // Using Tellor, Tellor breaks
  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(dec(13, 18))
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(13, 18))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(13, 18))

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(123, 18))

    const now = await th.getLatestBlockTimestamp(web3)
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)
    await setEthUsdTellorPrice(dec(13, 18))
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: switch to bothOraclesSuspect", async () => {
    // deploy broken mock
    ethUsdMockTellor = await BrokenMockTellor.new(ethUsdQueryData)
    BrokenMockTellor.setAsDeployed(ethUsdMockTellor)
    ethUsdTellorCaller = await TellorCaller.new(ethUsdMockTellor.address, ethUsdQueryId)
    await setAddresses()

    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: switch to bothOraclesSuspect", async () => {
    // deploy broken mock
    brlUsdMockTellor = await BrokenMockTellor.new(brlUsdQueryData)
    BrokenMockTellor.setAsDeployed(brlUsdMockTellor)
    brlUsdTellorCaller = await TellorCaller.new(brlUsdMockTellor.address, brlUsdQueryId)
    await setAddresses()

    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: return last good price", async () => {
    // deploy broken mock
    ethUsdMockTellor = await BrokenMockTellor.new(ethUsdQueryData)
    BrokenMockTellor.setAsDeployed(ethUsdMockTellor)
    ethUsdTellorCaller = await TellorCaller.new(ethUsdMockTellor.address, ethUsdQueryId)
    await setAddresses()

    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
   
    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: return last good price", async () => {
    // deploy broken mock
    brlUsdMockTellor = await BrokenMockTellor.new(brlUsdQueryData)
    BrokenMockTellor.setAsDeployed(brlUsdMockTellor)
    brlUsdTellorCaller = await TellorCaller.new(brlUsdMockTellor.address, brlUsdQueryId)
    await setAddresses()

    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
   
    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await ethUsdMockTellor.setUpdateTime(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  // Using Tellor, Tellor breaks
  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await brlUsdMockTellor.setUpdateTime(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await ethUsdMockTellor.setUpdateTime(0)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await priceFeed.setLastGoodPrice(dec(123, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))
    
    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await brlUsdMockTellor.setUpdateTime(0)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(123, 18))
  })

  // Using Tellor, Tellor freezes
  it("C2 usingTellorChainlinkUntrusted: Tellor freezes - remain usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor, Chainlink untrusted
  })

  // Using Tellor, Tellor freezes
  it("C2 usingTellorChainlinkUntrusted: Tellor freezes - remain usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const brlUsdTellorUpdateTime = (await brlUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(brlUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor, Chainlink untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor freezes - return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(246, 18))
  })

  it("C2 usingTellorChainlinkUntrusted: Tellor freezes - return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await ethUsdMockChainlink.setPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))
    await brlUsdMockChainlink.setPrice(dec(99, 8))

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const brlUsdTellorUpdateTime = (await brlUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(brlUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setUpdateTime(now)
    await brlUsdMockChainlink.setUpdateTime(now)

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(246, 18))
  })
  
  // Using Tellor, both Chainlink & Tellor go live

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - switch to chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted
  
    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice(dec(105, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - switch to chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted
  
    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice(dec(105, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted
  
    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice(dec(105, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(105, 17))
  })

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted
  
    await setEthUsdTellorPrice(dec(10, 6))
    await setBrlUsdTellorPrice(dec(105, 6))
    await ethUsdMockChainlink.setPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(105, 8))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, '95238095238095238')
  })

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and > 5% price difference - remain usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice('10500000001')
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()
   
    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor, Chainlink untrusted
  })

  it("C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and > 5% price difference - return Tellor price", async () => {
    await setAddresses()
    priceFeed.setStatus(1) // status 1: using Tellor, Chainlink untrusted

    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice('10500000001')
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  // --- Case 3: Both Oracles suspect

  it("C3 bothOraclesUntrusted: both Tellor and Chainlink are live and > 5% price difference remain bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles untrusted

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice('10500000001') // price = 105.00000001: > 5% difference from Tellor
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C3 bothOraclesUntrusted: both Tellor and Chainlink are live and > 5% price difference, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles untrusted

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await setEthUsdTellorPrice(dec(100, 6))
    await setBrlUsdTellorPrice(dec(10, 6))
    await ethUsdMockChainlink.setPrice('10500000001') // price = 105.00000001: > 5% difference from Tellor
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await priceFeed.fetchPrice()
    const price = await priceFeed.lastGoodPrice()

    assert.equal(price, dec(50, 18))
  })

  it("C3 bothOraclesUntrusted: both Tellor and Chainlink are live and <= 5% price difference, switch to chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles untrusted

    await setEthUsdTellorPrice(dec(1, 8))
    await setBrlUsdTellorPrice(dec(1, 7))
    await ethUsdMockChainlink.setPrice(dec(105, 8)) // price = 105: 5% difference from Tellor
    await brlUsdMockChainlink.setPrice(dec(1, 9))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C3 bothOraclesUntrusted: both Tellor and Chainlink are live and <= 5% price difference, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(2) // status 2: both oracles untrusted

    await setEthUsdTellorPrice(dec(1, 8))
    await setBrlUsdTellorPrice(dec(1, 7))
    await ethUsdMockChainlink.setPrice(dec(105, 8)) // price = 105: 5% difference from Tellor
    await brlUsdMockChainlink.setPrice(dec(1, 9))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(105, 17))
  })

  // --- Case 4 ---
  it("C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, switch to bothOraclesSuspect", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    // Both Chainlink and Tellor break with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(2) // status 2: using tellor, chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    // Both Chainlink and Tellor break with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    // Both Chainlink and Tellor break with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor, Chainlink untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    // Both Chainlink and Tellor break with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, switch to usingTellorChainlinkUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(999, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(99, 8))

    // Chainlink breaks with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: using Tellor, Chainlink untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, return Tellor price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrevPrice(dec(12, 8))

    // Chainlink breaks with 0 price
    await ethUsdMockChainlink.setPrice(0)
    await brlUsdMockChainlink.setPrice(0)

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(12, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1025, 16))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, switch back to chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 6))
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, switch back to chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 6))
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1, 18))  // Chainlink price
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 6))
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(1, 18))  // Chainlink price
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with >5% price difference, switch back to usingTellorChainlinkUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(12, 8))
    await brlUsdMockChainlink.setPrice(dec(12, 8))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 1)  // status 1: Using Tellor, Chainlink untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with >5% price difference, return Tellor current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 8))
    await ethUsdMockChainlink.setPrice(dec(123, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(12, 8))
    await brlUsdMockChainlink.setPrice(dec(12, 8))

    await setEthUsdTellorPrice(dec(999, 6))
    await setBrlUsdTellorPrice(dec(99, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, '10090909090909090909')  // Tellor price
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with similar price, switch back to chainlinkWorking", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7))
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with similar price, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7))
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))  // Chainlink price
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7))
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: Using Chainlink, Tellor untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: Using Chainlink, Tellor untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7))
    await setBrlUsdTellorPrice(0)

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, return Chainlink current price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(122, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor breaks, switch to usingChainlinkTellorUntrusted", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    // set tellor broken
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(122, 6))
    await ethUsdMockTellor.set
    await brlUsdMockTellor.set

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor broken, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    // set tellor broken
    await setEthUsdTellorPrice(0)
    await setBrlUsdTellorPrice(dec(122, 6))
    await ethUsdMockTellor.set
    await brlUsdMockTellor.set

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, remain usingTellorChainlinkFrozen", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    // set Tellor to current time
    await ethUsdMockTellor.setUpdateTime(now)
    await brlUsdMockTellor.setUpdateTime(now)

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 3)  // status 3: using Tellor, Chainlink frozen
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, return Tellor price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, remain usingTellorChainlinkFrozen", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    // check Tellor price timestamp is out of date by > 4 hours
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(14400))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 3)  // status 3: using Tellor, Chainlink frozen
  })

  it("C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, return last good price", async () => { 
    await setAddresses()
    priceFeed.setStatus(3) // status 3: using Tellor, Chainlink frozen

    await priceFeed.setLastGoodPrice(dec(50, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdMockChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdMockChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    // check Tellor price timestamp is out of date by > 4 hours
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(14400))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(50, 18))
  })

  // --- Case 5 ---
  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - no status change", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // Greater than 5% difference with chainlink
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - no status change", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 5)) // Greater than 5% difference with chainlink

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // Greater than 5% difference with chainlink
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(123, 5)) // Greater than 5% difference with chainlink

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price within <5%, switch to chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7)) // within 5% of Chainlink
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price within <5%, switch to chainlinkWorking", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(122, 6)) // within 5% of Chainlink

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 0)  // status 0: Chainlink working
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, Tellor price not within 5%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(122, 7)) // within 5% of Chainlink
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, Tellor price not within 5%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))

    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(122, 6)) // within 5% of Chainlink

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  // ---------

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))
    
    await setEthUsdTellorPrice(dec(123, 7))
    await setBrlUsdTellorPrice(dec(999, 6)) // not close
 
    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))
    
    await setEthUsdTellorPrice(dec(999, 7)) // not close
    await setBrlUsdTellorPrice(dec(123, 6))
 
    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))
    
    await setEthUsdTellorPrice(dec(999, 7)) // not close
    await setBrlUsdTellorPrice(dec(123, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(123, 9))
    await ethUsdMockChainlink.setPrice(dec(123, 9))

    await brlUsdMockChainlink.setPrevPrice(dec(123, 8))
    await brlUsdMockChainlink.setPrice(dec(123, 8))
    
    await setEthUsdTellorPrice(dec(123, 7)) // not close
    await setBrlUsdTellorPrice(dec(999, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(10, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor price not within 5%, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(99, 8)) // >50% price drop from previous Chainlink price

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both Oracles untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous,  Tellor price not within 5%, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(99, 8)) // >50% price drop from previous Chainlink price

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18)) // last good price 
  })

  // -------

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, and Tellor is frozen, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours

    // check Tellor price timestamp is out of date by > 4 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setPrice(dec(199, 8))
    await brlUsdMockChainlink.setPrice(dec(101, 7))

    await ethUsdMockChainlink.setUpdateTime(now) // Chainlink is current
    await brlUsdMockChainlink.setUpdateTime(now) // Chainlink is current

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4)  // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor is frozen, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setPrice(dec(199, 8))
    await brlUsdMockChainlink.setPrice(dec(101, 7))

    await ethUsdMockChainlink.setUpdateTime(now) // Chainlink is current
    await brlUsdMockChainlink.setUpdateTime(now) // Chainlink is current

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, '19702970297029702970')
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor is frozen, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setPrice(dec(99, 8)) // >50% price drop from previous Chainlink price
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await ethUsdMockChainlink.setUpdateTime(now) // Chainlink is current
    await brlUsdMockChainlink.setUpdateTime(now) // Chainlink is current

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both Oracles untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor is frozen, return Chainlink price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4:  using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // fast forward 8 hours

    // check Tellor price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdTellorUpdateTime = (await ethUsdTellorCaller.getTellorCurrentValue.call())[2]
    assert.isTrue(ethUsdTellorUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await ethUsdMockChainlink.setPrice(dec(99, 8)) // >50% price drop from previous Chainlink price
    await brlUsdMockChainlink.setPrice(dec(10, 8))

    await ethUsdMockChainlink.setUpdateTime(now) // Chainlink is current
    await brlUsdMockChainlink.setUpdateTime(now) // Chainlink is current

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18)) // last good price 
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink frozen, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
   
    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4) // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink frozen, remain on usingChainlinkTellorUntrusted", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
   
    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const brlUsdChainlinkUpdateTime = (await brlUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(brlUsdChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 4) // status 4: using Chainlink, Tellor untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink frozen, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
   
    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const ethUsdChainlinkUpdateTime = (await ethUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(ethUsdChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink frozen, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
   
    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await th.fastForwardTime(28800, web3.currentProvider) // Fast forward 8 hours

    // check Chainlink price timestamp is out of date by > 8 hours
    const now = await th.getLatestBlockTimestamp(web3)
    const brlUsdChainlinkUpdateTime = (await brlUsdMockChainlink.latestRoundData())[3]
    assert.isTrue(brlUsdChainlinkUpdateTime.lt(toBN(now).sub(toBN(28800))))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink breaks too, switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
    await ethUsdMockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: when Chainlink breaks too, switch to bothOraclesSuspect", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
    await brlUsdMockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await setEthUsdTellorPrice(dec(200, 6))
    await setBrlUsdTellorPrice(dec(2, 6)) // not close

    await priceFeed.fetchPrice()

    const status = await priceFeed.status()
    assert.equal(status, 2)  // status 2: both oracles untrusted
  })

  it("C5 usingChainlinkTellorUntrusted: Chainlink breaks too, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
    await ethUsdMockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await setEthUsdTellorPrice(dec(123, 6)) // not close
    await setBrlUsdTellorPrice(dec(10, 6))

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })

  it("C5 usingChainlinkTellorUntrusted: Chainlink breaks too, return last good price", async () => {
    await setAddresses()
    priceFeed.setStatus(4) // status 4: using chainlink, Tellor untrusted

    await priceFeed.setLastGoodPrice(dec(246, 18))

    await ethUsdMockChainlink.setPrevPrice(dec(200, 8))
    await ethUsdMockChainlink.setPrice(dec(200, 8))

    await brlUsdMockChainlink.setPrevPrice(dec(10, 8))
    await brlUsdMockChainlink.setPrice(dec(10, 8))
    await brlUsdMockChainlink.setUpdateTime(0)  // Chainlink breaks by 0 timestamp

    await setEthUsdTellorPrice(dec(200, 6))
    await setBrlUsdTellorPrice(dec(2, 6)) // not close

    await priceFeed.fetchPrice()

    const price = await priceFeed.lastGoodPrice()
    assert.equal(price, dec(246, 18))
  })
})
