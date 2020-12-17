const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: Liquity functions with the caller restricted to Liquity contract(s)', async accounts => {

  const [owner, alice, bob, carol] = accounts;
  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  
  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYContracts()

    priceFeed = coreContracts.priceFeed
    lusdToken = coreContracts.lusdToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    nameRegistry = coreContracts.nameRegistry
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)

    await th.openTrove_allAccounts(accounts.slice(0, 10), coreContracts, dec(10, 'ether'), dec(100, 18))

    const expectedCISupplyCap = '33333333333333333333333333' // 100mil / 3

    // Check CI has been properly funded
    const bal = await lqtyToken.balanceOf(communityIssuance.address)
    assert.equal(bal, expectedCISupplyCap)
  })

  describe('BorrowerOperations', async accounts => { 
    it("moveETHGainToTrove(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const tx1= await borrowerOperations.moveETHGainToTrove(bob, bob, { from: bob })    
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.applyPendingRewards(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveRewardSnapshots(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert" )
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.removeStake(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateStakeAndTotalStakes(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.closeTrove(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.addTroveOwnerToArray(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.setTroveStatus(bob, 1, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveColl
    it("increaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveColl
    it("decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendETH
    it("sendETH(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendETH(alice, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // increaseLUSD	
    it("increaseLUSDDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseLUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager")
      }
    })

    // decreaseLUSD
    it("decreaseLUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseLUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendETH
    it("sendETH(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendETH(alice, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // increaseLUSD	
    it("increaseLUSDDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseLUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // decreaseLUSD	
    it("decreaseLUSD(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseLUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager --- 

    // offset
    it("offset(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not TroveManager")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)	
    it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "StabilityPool: Caller is not ActivePool")
      }
    })
  })

  describe('LUSDToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = lusdToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await lusdToken.burn(bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await lusdToken.sendToPool(bob, activePool.address, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await lusdToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
      }
    })
  })

  describe('SortedTroves', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.insert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is neither BO nor TroveM")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the TroveManager")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor TroveM")
      }
    })
  })

  describe('LockupContractFactory', async accounts => {
    it("setLQTYTokenAddress(): reverts when caller is not deployer", async () => {
      try {
        const txAlice = await lockupContractFactory.setLQTYTokenAddress(lqtyToken.address, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Owner can successfully set any address
      const txOwner1 = await lockupContractFactory.setLQTYTokenAddress(bob, { from: owner })
      const txOwner2 = await lockupContractFactory.setLQTYTokenAddress(lqtyToken.address, { from: owner })
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
      await lqtyToken.transfer(OYLC.address, dec(100, 18), { from: owner })

      try {
        const txAlice = await OYLC.lockContract({ from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully lock OYLC contract via Factory
      const txOwner = await lockupContractFactory.lockOneYearContracts([OYLC.address], { from: owner })
      assert.isTrue(txOwner.receipt.status)
    })

    it("withdrawLQTY(): reverts when caller is not beneficiary", async () => {
      // deploy new OYLC with Carol as beneficiary
      const deployedOYLCtx = await lockupContractFactory.deployOneYearLockupContract(carol, dec(100, 18), { from: owner })

      const OYLC = await th.getOYLCFromDeploymentTx(deployedOYLCtx)

      // Deployer funds the OYLC
      await lqtyToken.transfer(OYLC.address, dec(100, 18), { from: owner })

      // Deployer locks contract via the factory
      await lockupContractFactory.lockOneYearContracts([OYLC.address], { from: owner })
      assert.isTrue(await OYLC.active())

      // Fast-forward one year, so that beneficiary can withdraw
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Bob attempts to withdraw LQTY
      try {
        const txBob = await OYLC.withdrawLQTY({ from: bob })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Confirm beneficiary, Carol, can withdraw
      const txCarol = await OYLC.withdrawLQTY({ from: carol })
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
      await lqtyToken.transfer(CDLC.address, dec(100, 18), { from: owner })

      try {
        const txAlice = await CDLC.lockContract({ from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Deployer can successfully lock OYLC contract via Factory
      const txOwner1 = await lockupContractFactory.lockCustomDurationContracts([CDLC.address], { from: owner })
    })

    it("withdrawLQTY(): reverts when caller is not beneficiary", async () => {
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
      await lqtyToken.transfer(CDLC.address, dec(100, 18), { from: owner })

      // Deployer locks contract via the factory
      await lockupContractFactory.lockCustomDurationContracts([CDLC.address], { from: owner })
      assert.isTrue(await CDLC.active())

      // Fast-forward one month, so that beneficiary can withdraw
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Bob attempts to withdraw LQTY
      try {
        const txBob = await CDLC.withdrawLQTY({ from: bob })
     
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // Confirm beneficiary, Carol, can withdraw
      const txCarol = await CDLC.withdrawLQTY({ from: carol })
      assert.isTrue(txCarol.receipt.status)
    })
  })

  describe('LQTYStaking', async accounts => {
    it("addETHFee(): reverts when caller is not TroveManager", async () => {
      try {
        const txAlice = await lqtyStaking.increaseF_ETH(dec(1, 'ether'), { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("addLQTYFee(): reverts when caller is not TroveManager", async () => {
      try {
        const txAlice = await lqtyStaking.increaseF_LUSD(dec(1, 18), { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('LQTYToken', async accounts => {
    it("sendToLQTYStaking(): reverts when caller is not the LQTYSstaking", async () => {
      // Check owner has some LQTY
      assert.isTrue((await lqtyToken.balanceOf(owner)).gt(toBN('0')))

      // Owner tries to call it
      try {
        const tx = await lqtyToken.sendToLQTYStaking(owner, 1, { from: owner })
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // FF >> time one year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Owner transfers 1 LQTY to bob
      await lqtyToken.transfer(bob, dec(1, 18), { from: owner })
      assert.equal((await lqtyToken.balanceOf(bob)), dec(1, 18))

      // Bob tries to call it
      try {
        const tx = await lqtyToken.sendToLQTYStaking(bob, dec(1, 18), { from: bob })
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("sendLQTY(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.sendLQTY(alice, dec(100, 18), {from: alice})
      const tx2 = communityIssuance.sendLQTY(bob, dec(100, 18), {from: alice})
      const tx3 = communityIssuance.sendLQTY(stabilityPool.address, dec(100, 18), {from: alice})
     
      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issueLQTY(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.issueLQTY({from: alice})

      assertRevert(tx1)
    })
  })

  
})


