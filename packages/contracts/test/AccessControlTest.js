const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN

contract('All Liquity functions with intra-system access control restrictions', async accounts => {

  const [owner, alice, bob, carol] = accounts;
  let priceFeed
  let clvToken
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
    sortedCDPs = coreContracts.sortedCDPs
    cdpManager = coreContracts.cdpManager
    nameRegistry = coreContracts.nameRegistry
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    lqtyStaking = GTContracts.lqtyStaking
    growthToken = GTContracts.growthToken
    communityIssuance = GTContracts.communityIssuance
    lockupContractFactory = GTContracts.lockupContractFactory

    await deploymentHelper.connectGTContracts(GTContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, GTContracts)
    await deploymentHelper.connectGTContractsToCore(GTContracts, coreContracts)

    await th.openLoan_allAccounts(accounts.slice(0, 10), coreContracts, dec(10, 'ether'), dec(100, 18))
  })

  describe('CDPManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.applyPendingRewards(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.updateCDPRewardSnapshots(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.removeStake(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.updateStakeAndTotalStakes(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeCDP
    it("closeCDP(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.closeCDP(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // addCDPOwnerToArray
    it("addCDPOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.addCDPOwnerToArray(bob, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })


    // setCDPStatus
    it("setCDPStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.setCDPStatus(bob, 1, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPColl
    it("increaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.increaseCDPColl(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPColl
    it("decreaseCDPColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.decreaseCDPColl(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseCDPDebt
    it("increaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.increaseCDPDebt(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseCDPDebt
    it("decreaseCDPDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await cdpManager.decreaseCDPDebt(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        // assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendETH
    it("sendETH(): reverts when called by an account that is not BO nor CDPM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendETH(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor CDPManager nor StabilityPool")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not BO nor CDPM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor CDPManager")
      }
    })

    // decreaseCLV
    it("decreaseCLVDebt(): reverts when called by an account that is not BO nor CDPM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor CDPManager nor StabilityPool")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendETH
    it("sendETH(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendETH(alice, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // increaseCLV	
    it("increaseCLVDebt(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // decreaseCLV	
    it("decreaseCLV(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseCLVDebt(100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the CDPManager")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyCDPManager --- 

    // offset
    it("offset(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not CDPManager")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "StabilityPool: Caller is not ActivePool")
      }
    })
  })

  describe('CLVToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = clvToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor CDPM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.burn(bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor CDPManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.sendToPool(bob, activePool.address, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not CDPManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await clvToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither CDPManager nor StabilityPool")
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
    it("updatePrice(): reverts when called by an account that is not CDPManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await priceFeed.updatePrice({ from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not CDPManager")
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
      assert.equal(await OYLC.deployer(), lockupContractFactory.address)

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
          { from: owner }
        )

      const CDLC = await th.getCDLCFromDeploymentTx(deployedCDLCtx)

      // Check Factory is CDLC deployer
      assert.equal(await CDLC.deployer(), lockupContractFactory.address)

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

  describe('LQTYStaking', async accounts => {
    it("setGrowthTokenAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await lqtyStaking.setGrowthTokenAddress(growthToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = lqtyStaking.setGrowthTokenAddress(growthToken.address, { from: owner })
    })

    it("setCLVTokenAddress(): reverts when caller is not  deployer", async () => {
      try {
        const txAlice = await lqtyStaking.setCLVTokenAddress(clvToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = lqtyStaking.setCLVTokenAddress(clvToken.address, { from: owner })
    })

    it("setCDPManagerAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await lqtyStaking.setCDPManagerAddress(cdpManager.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = lqtyStaking.setCDPManagerAddress(cdpManager.address, { from: owner })
    })

    it("setBorrowerOperationsAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await lqtyStaking.setBorrowerOperationsAddress(borrowerOperations.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = lqtyStaking.setBorrowerOperationsAddress(borrowerOperations.address, { from: owner })
    })

    it("addETHFee(): reverts when caller is not CDPManager", async () => {
      try {
        const txAlice = await lqtyStaking.increaseF_ETH(dec(1, 'ether'), { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("addLQTYFee(): reverts when caller is not CDPManager", async () => {
      try {
        const txAlice = await lqtyStaking.increaseF_LUSD(dec(1, 18), { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("setGrowthTokenAddress(): reverts when caller is not deployer", async () => {

      const CINew = await CommunityIssuance.new()

      try {
        const txAlice = await CINew.setGrowthTokenAddress(growthToken.address, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully set address
      const txDeployer = CINew.setGrowthTokenAddress(growthToken.address, { from: owner })
    })
  })

  describe('GrowthToken', async accounts => {
    it("sendToLQTYStaking(): reverts when caller is not the LQTYSstaking", async () => {
      // Check owner has some LQTY
      assert.isTrue((await growthToken.balanceOf(owner)).gt(toBN('0')))

      // Owner tries to call it
      try {
        const tx = await growthToken.sendToLQTYStaking(owner, 1, { from: owner })
        assert.isFalse(tx.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // FF >> time one year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Owner transfers 1 LQTY to bob
      await growthToken.transfer(bob, dec(1, 18), { from: owner })
      assert.equal((await growthToken.balanceOf(bob)), dec(1, 18))

      // Bob tries to call it
      try {
        const tx = await growthToken.sendToLQTYStaking(bob, dec(1, 18), { from: bob })
        assert.isFalse(tx.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })
})


