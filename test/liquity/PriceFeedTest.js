
const PriceFeed = artifacts.require("./PriceFeedTester.sol")
const AdminContract = artifacts.require("./AdminContract.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockChainlink = artifacts.require("./MockAggregator.sol")
const ChainlinkFlagMock = artifacts.require("./ChainlinkFlagMock.sol")

const { isCommunityResourcable } = require("@ethersproject/providers")
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants")
const testHelpers = require("../../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

const EMPTY_ADDRESS = '0x' + '0'.repeat(40);

const DEFAULT_INDEX = dec(1, 18);
const DEFAULT_PRICE = dec(100, 18);

const DEFAULT_INDEX_e9 = dec(1, 9);
const DEFAULT_PRICE_e8 = dec(100, 8);

contract('PriceFeed', async accounts => {

  const [owner, alice] = accounts;
  let priceFeedTestnet
  let priceFeed
  let zeroAddressPriceFeed
  let chainFlagMock
  let mockChainlink
  let mockChainlinkIndex
  let adminContract

  const setAddressesAndOracle = async () => {
    await priceFeed.setAddresses(chainFlagMock.address, adminContract.address, { from: owner })
    await priceFeed.addOracle(
      EMPTY_ADDRESS,
      mockChainlink.address,
      mockChainlinkIndex.address !== undefined ? mockChainlinkIndex.address : ZERO_ADDRESS)
  }

  const getFetchPriceWithContractValues = async () => {
    return getFetchPriceWithDifferentValue(undefined, undefined);
  }

  const getFetchPriceWithDifferentValue = async (price, index) => {
    if (price === undefined)
      price = await priceFeed.lastGoodPrice(ZERO_ADDRESS);

    if (index === undefined)
      index = await priceFeed.lastGoodIndex(ZERO_ADDRESS);

    price = price.toString();
    index = index.toString();

    return toBN(price).mul(toBN(index)).div(toBN(dec(1, 18))).toString();
  }

  beforeEach(async () => {
    chainFlagMock = await ChainlinkFlagMock.new()
    ChainlinkFlagMock.setAsDeployed(chainFlagMock)

    priceFeedTestnet = await PriceFeedTestnet.new()
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

    priceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(priceFeed)

    zeroAddressPriceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(zeroAddressPriceFeed)

    mockChainlink = await MockChainlink.new()
    MockChainlink.setAsDeployed(mockChainlink)

    mockChainlinkIndex = await MockChainlink.new()
    MockChainlink.setAsDeployed(mockChainlinkIndex)

    adminContract = await AdminContract.new()
    AdminContract.setAsDeployed(adminContract)

    // Set Chainlink latest and prev round Id's to non-zero
    await mockChainlink.setLatestRoundId(3)
    await mockChainlink.setPrevRoundId(2)
    await mockChainlinkIndex.setLatestRoundId(3)
    await mockChainlinkIndex.setPrevRoundId(2)

    //Set current and prev prices in both oracles
    await mockChainlink.setPrice(DEFAULT_PRICE_e8)
    await mockChainlink.setPrevPrice(DEFAULT_PRICE_e8)
    await mockChainlinkIndex.setPrice(DEFAULT_INDEX_e9)
    await mockChainlinkIndex.setPrevPrice(DEFAULT_INDEX_e9)

    await mockChainlink.setDecimals(8)
    await mockChainlinkIndex.setDecimals(9)

    // Set mock price updateTimes in both oracles to very recent
    const now = await th.getLatestBlockTimestamp(web3)
    await mockChainlink.setUpdateTime(now)
    await mockChainlinkIndex.setUpdateTime(now)
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
    it("setAddressesAndOracle should fail after address has already been set", async () => {
      // Owner can successfully set any address
      const txOwner = await priceFeed.setAddresses(chainFlagMock.address, adminContract.address, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      await assertRevert(
        priceFeed.setAddresses(chainFlagMock.address, adminContract.address, { from: owner })
      )

      await assertRevert(
        priceFeed.setAddresses(chainFlagMock.address, adminContract.address, { from: alice }),
        "OwnableUpgradeable: caller is not the owner"
      )
    })
  })


  // Vesta Tests :: Start
  it("Validate default status on setAddressesAndOracle", async () => {
    await setAddressesAndOracle()
    assert.equal(await priceFeed.status(), '0');
  })

  it("addOracle as User: Reverts", async () => {
    await setAddressesAndOracle()
    await assertRevert(
      priceFeed.addOracle(EMPTY_ADDRESS,
        mockChainlink.address,
        mockChainlinkIndex.address, { from: alice }),
      "OwnableUpgradeable: caller is not the owner"
    )
  })

  it("addOracle as Owner: Oracle Works, index broken, reverts", async () => {
    await setAddressesAndOracle()
    await mockChainlinkIndex.setLatestRoundId(0)
    await assertRevert(
      priceFeed.addOracle(EMPTY_ADDRESS,
        mockChainlink.address,
        mockChainlinkIndex.address)
    )
  })


  it("addOracle as Owner: Oracle broken, index works, reverts", async () => {
    await setAddressesAndOracle()
    await mockChainlink.setLatestRoundId(0)
    await assertRevert(
      priceFeed.addOracle(EMPTY_ADDRESS,
        mockChainlink.address,
        mockChainlinkIndex.address)
    )
  })


  it("addOracle as Owner: Oracle works, index zero address, adds new oracle", async () => {
    await setAddressesAndOracle()
    await priceFeed.addOracle(EMPTY_ADDRESS,
      mockChainlink.address,
      ZERO_ADDRESS)

    const price = await getFetchPriceWithContractValues()
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, dec(1, 18)));
  })


  it("addOracle as Owner: All chainlink reponses are good, add new oracle", async () => {
    await mockChainlink.setPrice(dec(1236, 8))
    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));

    await setAddressesAndOracle()

    const price = await getFetchPriceWithContractValues()
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(1236, 18), dec(2, 18)));
  })

  it("ChainlinkWorking: Chainlink Responses are good, return price and remain same State", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrice(dec(1236, 8))
    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues()

    const statusAfter = await priceFeed.status()

    assert.equal(statusAfter.toString(), statusBefore.toString());
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(1236, 18), dec(2, 18)))
  })

  it("ChainlinkWorking: Oracle Works, index zero address, return price and remain same State", async () => {
    mockChainlinkIndex = ZERO_ADDRESS;

    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues();
    const statusAfter = await priceFeed.status()

    assert.equal(statusAfter, statusBefore.toString());
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(1, 18)))
  })

  it("ChainlinkWorking: Flag returns true, return lastGoodPrice and lastGoodIndex, change state to broken", async () => {
    await setAddressesAndOracle()
    await chainFlagMock.setFlag(true);

    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues()
    const statusAfter = await priceFeed.status()

    assert.notEqual(statusAfter, statusBefore);
    assert.equal(statusAfter, '1');
    assert.notEqual(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(2, 18)))
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, DEFAULT_INDEX))
  })


  it("ChainlinkWorking: Oracle works, index broken, return price with lastGoodIndex, and change State to broken", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));
    await mockChainlinkIndex.setLatestRoundId(0);

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues()
    const statusAfter = await priceFeed.status()

    assert.notEqual(statusAfter, statusBefore);
    assert.equal(statusAfter, '1');
    assert.notEqual(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(2, 18)))
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(1234, 18), DEFAULT_INDEX))
  })

  it("ChainlinkWorking: Oracle broken, index works, return price wiht lastGoodIndex, and change State to broken", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await mockChainlink.setLatestRoundId(0);

    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues()

    const statusAfter = await priceFeed.status()

    assert.notEqual(statusAfter, statusBefore);
    assert.equal(statusAfter, '1');
    assert.notEqual(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(2, 18)))
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, dec(2, 18)))
  })


  it("ChainlinkWorking: Oracle broken, index broken, return price wiht lastGoodPrice and lastGoodIndex, and change State to broken", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status();

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await mockChainlink.setLatestRoundId(0);

    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(1, 9));
    await mockChainlinkIndex.setLatestRoundId(0);

    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await getFetchPriceWithContractValues()
    const statusAfter = await priceFeed.status()

    assert.notEqual(statusAfter, statusBefore);
    assert.equal(statusAfter, '1');
    assert.notEqual(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(2, 18)))
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, DEFAULT_INDEX))
  })

  // Vesta Tests :: End

  it("C1 Chainlink working: fetchPrice should return the correct price, taking into account the number of decimal digits on the aggregator", async () => {
    await setAddressesAndOracle()

    // Oracle price price is 10.00000000
    await mockChainlink.setDecimals(8)
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(1, 9))
    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    let price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    // Check Liquity PriceFeed gives 10, with 18 digit precision
    assert.equal(price, dec(10, 18))

    // Oracle price is 1e9
    await mockChainlink.setDecimals(0)
    await mockChainlink.setPrevPrice(dec(1, 9))
    await mockChainlink.setPrice(dec(1, 9))
    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    // Check Liquity PriceFeed gives 1e9, with 18 digit precision
    assert.isTrue(price.eq(toBN(dec(1, 27))))

    // Oracle price is 0.0001
    await mockChainlink.setDecimals(18)
    const decimals = await mockChainlink.decimals()

    await mockChainlink.setPrevPrice(dec(1, 14))
    await mockChainlink.setPrice(dec(1, 14))
    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    assert.isTrue(price.eq(toBN(dec(1, 14))))

    // Oracle price is 1234.56789
    await mockChainlink.setDecimals(5)
    await mockChainlink.setPrevPrice(dec(123456789))
    await mockChainlink.setPrice(dec(123456789))
    await priceFeed.fetchPrice(EMPTY_ADDRESS)
    price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    // Check Liquity PriceFeed gives 0.0001 with 18 digit precision
    assert.equal(price, '1234567890000000000000')
  })

  // --- Chainlink timeout --- 

  it("C1 chainlinkWorking: Chainlink is out of date by <3hrs: remain chainlinkWorking", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await th.fastForwardTime(10740, web3.currentProvider) // fast forward 2hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink is out of date by <3hrs: return Chainklink price", async () => {
    await setAddressesAndOracle()
    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    const decimals = await mockChainlink.decimals()

    await mockChainlink.setPrevPrice(dec(1234, 8))
    await mockChainlink.setPrice(dec(1234, 8))
    await th.fastForwardTime(10740, web3.currentProvider) // fast forward 2hrs 59 minutes 

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    assert.equal(price, dec(1234, 18))
  })

  // --- Chainlink price deviation ---

  it("C1 chainlinkWorking: Chainlink price drop of 50%, remain chainlinkWorking", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(1, 8))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price drop of 50%, return the Chainlink price", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(1, 8))  // price drops to 1

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)

    let price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    assert.equal(price, dec(1, 18))
  })

  it("C1 chainlinkWorking: Chainlink price drop of <50%, remain chainlinkWorking", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(100000001))   // price drops to 1.00000001:  a drop of < 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working 
  })

  it("C1 chainlinkWorking: Chainlink price drop of <50%, return Chainlink price", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(100000001)   // price drops to 1.00000001:  a drop of < 50% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)

    let price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    assert.equal(price, dec(100000001, 10))
  })


  it("C1 chainlinkWorking: Chainlink price increase of 100%, remain chainlinkWorking", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of 100%, return Chainlink price", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(dec(4, 8))  // price increases to 4: an increase of 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    let price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    assert.equal(price, dec(4, 18))
  })

  it("C1 chainlinkWorking: Chainlink price increase of <100%, remain chainlinkWorking", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    const statusAfter = await priceFeed.status()
    assert.equal(statusAfter, '0') // status 0: Chainlink working
  })

  it("C1 chainlinkWorking: Chainlink price increase of <100%,  return Chainlink price", async () => {
    await setAddressesAndOracle()
    priceFeed.setLastGoodPrice(dec(2, 18))

    const statusBefore = await priceFeed.status()
    assert.equal(statusBefore, '0') // status 0: Chainlink working

    await mockChainlink.setPrevPrice(dec(2, 8))  // price = 2
    await mockChainlink.setPrice(399999999)  // price increases to 3.99999999: an increase of < 100% from previous

    const priceFetchTx = await priceFeed.fetchPrice(EMPTY_ADDRESS)
    let price = await priceFeed.lastGoodPrice(EMPTY_ADDRESS)
    assert.equal(price, dec(399999999, 10))
  })


  // Vesta Tests :: Starts

  it("chainlinkUntrusted: Oracles and Index are still broken, uses lastGoodPrice & lastGoodIndex and keep status", async () => {
    await setAddressesAndOracle()

    await mockChainlink.setLatestRoundId(0);
    await mockChainlinkIndex.setLatestRoundId(0);
    await priceFeed.fetchPrice(ZERO_ADDRESS);

    const beforeStatus = await priceFeed.status();

    await mockChainlink.setPrice(dec(1234, 8));
    await mockChainlink.setPrevPrice(dec(1234, 8));
    await mockChainlinkIndex.setPrice(dec(4, 9));
    await mockChainlinkIndex.setPrevPrice(dec(4, 9));

    await priceFeed.fetchPrice(ZERO_ADDRESS);
    const afterStatus = await priceFeed.status();
    const price = await getFetchPriceWithContractValues();


    assert.equal(beforeStatus, afterStatus.toString())
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, DEFAULT_INDEX));
  })

  it("chainlinUntrusted: Oracle works, index broken, uses oracle price, keep lastGoodIndex and keep status", async () => {
    await setAddressesAndOracle()

    await mockChainlink.setLatestRoundId(0);
    await mockChainlinkIndex.setLatestRoundId(0);
    await priceFeed.fetchPrice(ZERO_ADDRESS);

    const beforeStatus = await priceFeed.status();

    await mockChainlink.setPrice(dec(12345, 8));
    await mockChainlink.setPrevPrice(dec(12345, 8));
    await mockChainlink.setLatestRoundId(4);
    await mockChainlink.setPrevRoundId(3);

    await mockChainlinkIndex.setPrice(dec(4, 9));
    await mockChainlinkIndex.setPrevPrice(dec(4, 9));

    await priceFeed.fetchPrice(ZERO_ADDRESS);
    const afterStatus = await priceFeed.status();
    const price = await getFetchPriceWithContractValues();


    assert.equal(beforeStatus, afterStatus.toString())
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(12345, 18), DEFAULT_INDEX));
  })


  it("chainlinUntrusted: Oracle broken, index works, uses index, keep lastGoodPrice and keep status", async () => {
    await setAddressesAndOracle()

    await mockChainlink.setLatestRoundId(0);
    await mockChainlinkIndex.setLatestRoundId(0);

    await priceFeed.fetchPrice(ZERO_ADDRESS);

    const beforeStatus = await priceFeed.status();

    await mockChainlinkIndex.setPrice(dec(2, 9));
    await mockChainlinkIndex.setPrevPrice(dec(2, 9));
    await mockChainlinkIndex.setLatestRoundId(4);
    await mockChainlinkIndex.setPrevRoundId(3);

    await mockChainlink.setPrice(dec(1234, 8));
    await mockChainlink.setPrevPrice(dec(1234, 8));

    await priceFeed.fetchPrice(ZERO_ADDRESS);

    const afterStatus = await priceFeed.status();
    const price = await getFetchPriceWithContractValues();


    assert.equal(beforeStatus, afterStatus.toString())
    assert.equal(price, await getFetchPriceWithDifferentValue(DEFAULT_PRICE, dec(2, 18)));
  })


  it("chainlinUntrusted: Oracle and Index work, uses chainlink and update status to working", async () => {
    await setAddressesAndOracle()

    await mockChainlink.setLatestRoundId(0);
    await mockChainlinkIndex.setLatestRoundId(0);
    await priceFeed.fetchPrice(ZERO_ADDRESS);

    await mockChainlink.setPrice(dec(1234, 8));
    await mockChainlink.setPrevPrice(dec(1234, 8));
    await mockChainlink.setLatestRoundId(4);
    await mockChainlink.setPrevRoundId(3);

    await mockChainlinkIndex.setPrice(dec(4, 9));
    await mockChainlinkIndex.setPrevPrice(dec(4, 9));
    await mockChainlinkIndex.setLatestRoundId(4);
    await mockChainlinkIndex.setPrevRoundId(3);

    await priceFeed.fetchPrice(ZERO_ADDRESS);
    const afterStatus = await priceFeed.status();
    const price = await getFetchPriceWithContractValues();


    assert.equal(afterStatus, '0')
    assert.equal(price, await getFetchPriceWithDifferentValue(dec(1234, 18), dec(4, 18)));
  })

  // Vesta Tests :: Ends


})


