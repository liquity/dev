const deploymentHelpers = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CLVTokenData = artifacts.require("./CLVTokenData.sol")
const deployLiquity = deploymentHelpers.deployLiquity
const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues

contract('All Liquity functions with intra-system access control restrictions', async accounts => {

  const [owner, alice, bob, carol] = accounts;
  let priceFeed
  let clvToken
  let poolManager
  let sortedCDPs
  let cdpManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  before(async () => {
    const contracts = await deployLiquity()

    priceFeed = contracts.priceFeed
    clvToken = contracts.clvToken
    poolManager = contracts.poolManager
    sortedCDPs = contracts.sortedCDPs
    cdpManager = contracts.cdpManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations

    const contractAddresses = getAddresses(contracts)
    await connectContracts(contracts, contractAddresses)

    th.openLoan_allAccounts(accounts.slice(0, 10), borrowerOperations, mv._10_Ether, mv._100e18)
  })

  describe('CDPManager', async accounts => {

    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.applyPendingRewards(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.updateCDPRewardSnapshots(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.removeStake(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.updateStakeAndTotalStakes(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeCDP
    it("closeCDP(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.closeCDP(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // addCDPOwnerToArray
    it("addCDPOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.addCDPOwnerToArray(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // setCDPStatus
    it("setCDPStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.setCDPStatus(bob, 1, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPColl
    it("increaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.increaseCDPColl(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPColl
    it("decreaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.decreaseCDPColl(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPDebt
    it("increaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.increaseCDPDebt(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPDebt
    it("decreaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await cdpManager.decreaseCDPDebt(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('PoolManager', async accounts => {

    // --- onlyCDPManager --- 
    //liquidate
    it("liquidate(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.liquidate(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // moveDistributionRewardsToActivePool
    it("moveDistributionRewardsToActivePool(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.moveDistributionRewardsToActivePool(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // redeemCollateral
    it("redeemCollateral(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.redeemCollateral(bob, 100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // offset
    it("offset(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.offset(100, 10, 1000, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })


    // --- onlyBorrowerOperations ---
    // addColl
    it("addColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.addColl({ from: alice, value: 100 })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // withdrawColl
    it("withdrawColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.withdrawColl(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // withdrawCLV
    it("withdrawCLV(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.withdrawCLV(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // repayCLV
    it("repayCLV(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await poolManager.repayCLV(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // fallback (payment)
    it("fallback(): reverts when called by an account that is neither StabilityPool nor ActivePool", async () => {
      // Attempt call from alice
      try {
        txAlice = await web3.eth.sendTransaction({ from: alice, to: poolManager.address, value: 100 })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither StabilityPool nor ActivePool")
      }
    })
  })

  describe('ActivePool', async accounts => {

    // --- onlyPoolManager ---

    // sendETH onlyPoolManager
    it("sendETH(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.sendETH(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.increaseCLVDebt(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV
    it("decreaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await activePool.decreaseCLVDebt(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // --- onlyPoolManagerOrPool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is neither PoolManager nor a Pool", async () => {
      // Attempt call from alice
      try {
        txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither the PoolManager nor a Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendETH onlyPoolManager
    it("sendETH(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.sendETH(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.increaseCLVDebt(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV	
    it("decreaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await defaultPool.decreaseCLVDebt(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // --- onlyPoolManagerOrPool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is neither PoolManager nor a Pool", async () => {
      // Attempt call from alice
      try {
        txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither the PoolManager nor a Pool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    it("sendETH(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.sendETH(alice, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // increaseCLV	
    it("increaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.increaseCLV(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV	
    it("decreaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.decreaseCLV(100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // --- onlyPoolManagerOrPool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is neither PoolManager nor a Pool", async () => {
      // Attempt call from alice
      try {
        txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither the PoolManager nor a Pool")
      }
    })
  })

  describe('CLVToken', async accounts => {

    // --- onlyCLVTokenAddress

    //    mint
    it("mint(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await clvToken.mint(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // burn
    it("burn(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await clvToken.burn(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await clvToken.sendToPool(bob, activePool.address, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await clvToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })
  })


  describe('CLVTokenData', async accounts => {

    //   // --- onlyCLVTokenAddress ---

    // setBalance
    it("setBalance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        txAlice = await clvTokenData.setBalance(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    // addToBalance
    it("addToBalance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        txAlice = await clvTokenData.addToBalance(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CLVToken contract")
      }
    })

    // subFromBalance
    it("subFromBalance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        txAlice = await clvTokenData.subFromBalance(bob, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CLVToken contract")
      }
    })

    // setAllowance
    it("setAllowance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        txAlice = await clvTokenData.setAllowance(bob, carol, 100, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('SortedCDPs', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        txAlice = await sortedCDPs.insert(bob, '150000000000000000000', '150000000000000000000', bob, bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // --- onlyCDPManager ---
    // remove
    it("remove(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await sortedCDPs.remove(bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the CDPManager")
      }
    })

    // --- onlyCDPMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await sortedCDPs.reInsert(bob, '150000000000000000000', '150000000000000000000', bob, bob, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor CDPM")
      }
    })
  })

  describe('PriceFeed', async accounts => {
    it("updatePrice(): reverts when called by an account that is not CDPManager or PoolManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await priceFeed.updatePrice({ from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither CDPManager nor PoolManager")
      }
    })
  })
})