const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CLVTokenData = artifacts.require("./CLVTokenData.sol")
const OneYearLockupContract = artifacts.require(("./OneYearLockupContract.sol"))
const CustomDurationLockupContract = artifacts.require(("./CustomDurationLockupContract.sol"))

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec


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
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const GTContracts = await deploymentHelper.deployGTContracts()

    priceFeed = coreContracts.priceFeed
    clvToken = coreContracts.clvToken
    poolManager = coreContracts.poolManager
    sortedCDPs = coreContracts.sortedCDPs
    cdpManager = coreContracts.cdpManager
    nameRegistry = coreContracts.nameRegistry
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    gtStaking = GTContracts.gtStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(coreContracts)
    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, coreContracts)

    th.openLoan_allAccounts(accounts.slice(0, 10), coreContracts, dec(10, 'ether'), dec(100, 18))
  })

  describe('CDPManager', async accounts => {

    it("getBorrowingFee(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.getBorrowingFee(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.applyPendingRewards(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.updateCDPRewardSnapshots(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.removeStake(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.updateStakeAndTotalStakes(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeCDP
    it("closeCDP(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.closeCDP(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // addCDPOwnerToArray
    it("addCDPOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.addCDPOwnerToArray(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // setCDPStatus
    it("setCDPStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.setCDPStatus(bob, 1, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPColl
    it("increaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.increaseCDPColl(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPColl
    it("decreaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.decreaseCDPColl(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPDebt
    it("increaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.increaseCDPDebt(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPDebt
    it("decreaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.decreaseCDPDebt(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await poolManager.liquidate(100, 10, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // movePendingTroveRewardsToActivePool
    it("movePendingTroveRewardsToActivePool(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.movePendingTroveRewardsToActivePool(100, 10, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // redeemCollateral
    it("redeemCollateral(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.redeemCollateral(bob, 100, 10, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // offset
    it("offset(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.offset(100, 10, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await poolManager.addColl({ from: alice, value: 100 })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // withdrawColl
    it("withdrawColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.withdrawColl(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // withdrawCLV
    it("withdrawCLV(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.withdrawCLV(alice, 100, 10, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // repayCLV
    it("repayCLV(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await poolManager.repayCLV(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // fallback (payment)
    it("fallback(): reverts when called by an account that is neither StabilityPool nor ActivePool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: poolManager.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither StabilityPool nor ActivePool")
      }
    })
  })

  describe('ActivePool', async accounts => {

    // --- onlyPoolManager ---

    // sendETH onlyPoolManager
    it("sendETH(): reverts when called by an account that is not PoolManager or CDPM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendETH(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither the PoolManager nor CDPManager")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV
    it("decreaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await defaultPool.sendETH(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV	
    it("decreaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await stabilityPool.sendETH(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // increaseCLV	
    it("increaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await stabilityPool.increaseCLV(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // decreaseCLV	
    it("decreaseCLV(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await stabilityPool.decreaseCLV(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await clvToken.mint(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PM or CDPM")
      }
    })

    // burn
    it("burn(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.burn(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.sendToPool(bob, activePool.address, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the PoolManager")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not PoolManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await clvTokenData.setBalance(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await clvTokenData.addToBalance(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    // subFromBalance
    it("subFromBalance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        const txAlice = await clvTokenData.subFromBalance(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    // setAllowance
    it("setAllowance(): reverts when called by an account that is not CLVToken", async () => {
      const tokenDataAddress = await clvToken.tokenDataAddress();
      const clvTokenData = await CLVTokenData.at(tokenDataAddress)

      // Attempt call from alice
      try {
        const txAlice = await clvTokenData.setAllowance(bob, carol, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('SortedCDPs', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or CDPM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedCDPs.insert(bob, '150000000000000000000', '150000000000000000000', bob, bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is neither BO nor CDPM")
      }
    })

    // --- onlyCDPManager ---
    // remove
    it("remove(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedCDPs.remove(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await sortedCDPs.reInsert(bob, '150000000000000000000', '150000000000000000000', bob, bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
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
        const txAlice = await priceFeed.updatePrice({ from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither CDPManager nor PoolManager")
      }
    })
  })

  describe('LockupContractFactory', async accounts => {
    it("setGrowthTokenAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await lockupContractFactory.setGrowthTokenAddress(growthToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await lockupContractFactory.setGrowthTokenAddress(bob, { from: owner })
      const txOwner2 = await lockupContractFactory.setGrowthTokenAddress(growthToken.address, { from: owner })
    })
  })

  describe('OneYearLockupContract', async accounts => {
    it("lockContract(): reverts when caller is not deployer", async () => {
      // deploy new OYLC with Carol as beneficiary
      const deployedOYLCtx = await lockupContractFactory.deployOneYearLockupContract(carol, dec(100, 18), { from: owner })

      const OYLC = await th.getOYLCFromDeploymentTx(deployedOYLCtx)

      // Check Factory is OYLC deployer
      assert.equal(await OYLC.lockupDeployer(), lockupContractFactory.address)

      // Deployer funds the OYLC
      await growthToken.transfer(OYLC.address, dec(100, 18), { from: owner })

      try {
        const txAlice = await OYLC.lockContract({ from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully lock OYLC contract via Factory
      const txOwner = await lockupContractFactory.lockOneYearContracts([OYLC.address], { from: owner })
      assert.isTrue(txOwner.receipt.status)
    })

    it("withdrawGT(): reverts when caller is not beneficiary", async () => {
      // deploy new OYLC with Carol as beneficiary
      const deployedOYLCtx = await lockupContractFactory.deployOneYearLockupContract(carol, dec(100, 18), { from: owner })

      const OYLC = await th.getOYLCFromDeploymentTx(deployedOYLCtx)

      // Deployer funds the OYLC
      await growthToken.transfer(OYLC.address, dec(100, 18), { from: owner })

      // Deployer locks contract via the factory
      await lockupContractFactory.lockOneYearContracts([OYLC.address], { from: owner })
      assert.isTrue(await OYLC.active())

      // Fast-forward one year, so that beneficiary can withdraw
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Bob attempts to withdraw GT
      try {
        const txBob = await OYLC.withdrawGT({ from: bob })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Confirm beneficiary, Carol, can withdraw
      const txCarol = await OYLC.withdrawGT({ from: carol })
      assert.isTrue(txCarol.receipt.status)
    })
  })

  describe('CustomDurationLockupContract', async accounts => {
    it("lockContract(): reverts when caller is not deployer", async () => {
      // 1 year passes since LockupContractFactory deployment, so that it can deploy CDLCs
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // deploy new CDLC with 1 month duration and Carol as beneficiary
      const deployedCDLCtx = await lockupContractFactory
      .deployCustomDurationLockupContract(
        carol,
        dec(100, 18),
        timeValues.SECONDS_IN_ONE_MONTH,
        { from: owner })

      const CDLC = await th.getCDLCFromDeploymentTx(deployedCDLCtx)

      // Check Factory is CDLC deployer
      assert.equal(await CDLC.lockupDeployer(), lockupContractFactory.address)

      // Deployer funds the CDLC
      await growthToken.transfer(CDLC.address, dec(100, 18), { from: owner })


      try {
        const txAlice = await CDLC.lockContract({ from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully lock OYLC contract via Factory
      const txOwner1 = await lockupContractFactory.lockCustomDurationContracts([CDLC.address], { from: owner })
    })

    it("withdrawGT(): reverts when caller is not beneficiary", async () => {
       // 1 year passes since LockupContractFactory deployment, so that it can deploy CDLCs
       await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // deploy new CDLC with 1 month duration and Carol as beneficiary
      const deployedCDLCtx = await lockupContractFactory
      .deployCustomDurationLockupContract(
        carol,
        dec(100, 18),
        timeValues.SECONDS_IN_ONE_MONTH,
        { from: owner })

      const CDLC = await th.getCDLCFromDeploymentTx(deployedCDLCtx)

      // Deployer funds the CDLC
      await growthToken.transfer(CDLC.address, dec(100, 18), { from: owner })

      // Deployer locks contract via the factory
      await lockupContractFactory.lockCustomDurationContracts([CDLC.address], { from: owner })
      assert.isTrue(await CDLC.active())

      // Fast-forward one month, so that beneficiary can withdraw
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Bob attempts to withdraw GT
      try {
        const txBob = await CDLC.withdrawGT({ from: bob })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Confirm beneficiary, Carol, can withdraw
      const txCarol = await CDLC.withdrawGT({ from: carol })
      assert.isTrue(txCarol.receipt.status)
    })
  })

  describe('GTStaking', async accounts => { 
    it("setGrowthTokenAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await gtStaking.setGrowthTokenAddress(growthToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer =  gtStaking.setGrowthTokenAddress(growthToken.address, { from: owner })
    })

    it("setCLVTokenAddress(): reverts when caller is not  deployer", async () => {
      try {
        const txAlice = await gtStaking.setCLVTokenAddress(clvToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer =  gtStaking.setCLVTokenAddress(clvToken.address, { from: owner })
    })

    it("setCDPManagerAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await gtStaking.setCDPManagerAddress(cdpManager.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = gtStaking.setCDPManagerAddress(cdpManager.address, { from: owner })
    })

    it("setBorrowerOperationsAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await gtStaking.setBorrowerOperationsAddress(borrowerOperations.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = gtStaking.setBorrowerOperationsAddress(borrowerOperations.address, { from: owner })
    })

    it("addETHFee(): reverts when caller is not CDPManager", async () => {
      try {
        const txAlice = await gtStaking.addETHFee({ from: alice, value: dec(1, 'ether')})
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("addLQTYFee(): reverts when caller is not CDPManager", async () => {
      try {
        const txAlice = await gtStaking.addLQTYFee(dec(1, 18), { from: alice})
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => { 
    it("setGrowthTokenAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await communityIssuance.setGrowthTokenAddress(growthToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer =  communityIssuance.setGrowthTokenAddress(growthToken.address, { from: owner })
    })
  })
})

