const { current } = require("@openzeppelin/test-helpers/src/balance")
const { web3 } = require("@openzeppelin/test-helpers/src/setup")
const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

contract('LockedVSTATest', async accounts => {
  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const assertRevert = th.assertRevert
  const timeValues = testHelpers.TimeValues

  const [owner, user, A, B, C, D, E, multisig, treasury] = accounts;

  const SIX_MONTHS = toBN('15724800');
  const TWO_YEARS = toBN('63072000');

  let contracts
  let lockedVSTA
  let vstaToken
  let TOTAL_VSTA

  async function applyVestingFormula(vestingRule, ignoreClaimed) {
    const currentTime = toBN(await th.getLatestBlockTimestamp(web3));

    if (currentTime < vestingRule.startVestingDate.toString())
      return toBN(0);

    if (currentTime >= vestingRule.endVestingDate.toString())
      return vestingRule.totalSupply.sub(vestingRule.claimed);

    return vestingRule.totalSupply
      .div(TWO_YEARS)
      .mul(currentTime.sub(vestingRule.createdDate))
      .sub(ignoreClaimed ? vestingRule.claimed : toBN(0))
  }


  describe("Locked VSTA", async () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(treasury)

      lockedVSTA = VSTAContracts.lockedVSTA
      vstaToken = VSTAContracts.vstaToken;

      await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
      await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts, true)

      await VSTAContracts.vstaToken.approve(lockedVSTA.address, ethers.constants.MaxUint256, { from: treasury });

      await lockedVSTA.transferOwnership(treasury);
      TOTAL_VSTA = await VSTAContracts.vstaToken.balanceOf(treasury)
    })

    it("Validate Time Constants", async () => {
      assert.equal((await lockedVSTA.SIX_MONTHS()).toString(), SIX_MONTHS)
      assert.equal((await lockedVSTA.TWO_YEARS()).toString(), TWO_YEARS)
    })

    it("addEntityVesting: called by user, valid inputs, revert transaction", async () => {
      await assertRevert(lockedVSTA.addEntityVesting(A, dec(100, 18), { from: user }))
    })

    it("addEntityVesting: called by owner, Invalid Address then Invalid Supply (too much), revert transaction", async () => {
      await assertRevert(lockedVSTA.addEntityVesting(ZERO_ADDRESS, dec(100, 18), { from: treasury }))
      await assertRevert(lockedVSTA.addEntityVesting(A, TOTAL_VSTA.add(toBN(1)), { from: treasury }))
    })

    it("addEntityVesting: called by owner, valid input, duplicated Entity, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })
      await assertRevert(lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury }))
    })

    it("addEntityVesting: called by owner, valid input, add entities", async () => {
      [A, B, C].forEach(async (element) => {
        await lockedVSTA.addEntityVesting(element, dec(100, 18), { from: treasury })

        const entityVestingData = await lockedVSTA.entitiesVesting(element)

        assert.equal(entityVestingData.totalSupply.toString(), dec(100, 18))
        assert.isTrue(entityVestingData.createdDate.gt(0))
        assert.equal(entityVestingData.startVestingDate.toString(), entityVestingData.createdDate.add(SIX_MONTHS))
        assert.equal(entityVestingData.endVestingDate.toString(), entityVestingData.createdDate.add(TWO_YEARS))
        assert.equal(entityVestingData.claimed.toString(), 0)

        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_DAY, web3.currentProvider)
      });
    })

    it("lowerEntityVesting: called by user, valid inputs, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })
      await assertRevert(lockedVSTA.lowerEntityVesting(A, dec(70, 18), { from: user }))
    })

    it("lowerEntityVesting: called by owner, invalid entity, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })
      await assertRevert(lockedVSTA.lowerEntityVesting(B, dec(70, 18), { from: treasury }))
    })

    it("lowerEntityVesting: called by owner, new total supply goes <= total claimed, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)
      const claimable = await lockedVSTA.getClaimableVSTA(A);

      await assertRevert(lockedVSTA.lowerEntityVesting(A, claimable, { from: treasury }))
      await assertRevert(lockedVSTA.lowerEntityVesting(A, dec(2, 18), { from: treasury }))
    })


    it("lowerEntityVesting: called by owner, valid input, entity receives tokens and total is changed", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)
      const claimable = await lockedVSTA.getClaimableVSTA(A);
      const newTotal = claimable.add(toBN(dec(1, 18)));
      const entityVestingDataBefore = await lockedVSTA.entitiesVesting(A)


      await lockedVSTA.lowerEntityVesting(A, newTotal, { from: treasury })
      await assert.equal((await vstaToken.balanceOf(A)).toString(), await applyVestingFormula(entityVestingDataBefore, true))
      const entityVestingDataAfter = await lockedVSTA.entitiesVesting(A)

      await assert.equal(entityVestingDataAfter.totalSupply.toString(), newTotal)
      await assert.equal(entityVestingDataAfter.createdDate.toString(), entityVestingDataBefore.createdDate.toString())
      await assert.equal(entityVestingDataAfter.startVestingDate.toString(), entityVestingDataBefore.startVestingDate.toString())
      await assert.equal(entityVestingDataAfter.endVestingDate.toString(), entityVestingDataBefore.endVestingDate.toString())
      await assert.isTrue(entityVestingDataAfter.claimed.gt(entityVestingDataBefore.claimed))
    })

    it("removeEntityVesting: called by user, valid inputs, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })
      await assertRevert(lockedVSTA.removeEntityVesting(A, { from: user }))
    })

    it("removeEntityVesting: called by owner, Not valid Entity, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(100, 18), { from: treasury })
      await assertRevert(lockedVSTA.removeEntityVesting(B, { from: treasury }))
    })

    it("removeEntityVesting: called by owner, valid input, remove entity and pay due", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })
      await lockedVSTA.removeEntityVesting(A, { from: treasury })

      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      assert.equal(entityVestingData.totalSupply.toString(), 0)
      assert.equal(entityVestingData.createdDate.toString(), 0)
      assert.equal(entityVestingData.startVestingDate.toString(), 0)
      assert.equal(entityVestingData.endVestingDate.toString(), 0)
      assert.equal(entityVestingData.claimed.toString(), 0)

      await lockedVSTA.getClaimableVSTA(B);
      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)

      const claimable = await lockedVSTA.getClaimableVSTA(B);
      assert.isTrue(claimable.gt(toBN(0)));
      assert.equal((await vstaToken.balanceOf(B)).toString(), 0);

      await lockedVSTA.removeEntityVesting(B, { from: treasury })

      const entityVestingData_B = await lockedVSTA.entitiesVesting(B)
      assert.equal(entityVestingData_B.totalSupply.toString(), 0)
      assert.equal(entityVestingData_B.createdDate.toString(), 0)
      assert.equal(entityVestingData_B.startVestingDate.toString(), 0)
      assert.equal(entityVestingData_B.claimed.toString(), 0)

      assert.closeTo(th.getDifferenceEther(await vstaToken.balanceOf(B), claimable), 0, 1)
    })

    it("transferUnassignedVSTA: called by user, valid environment, revert transaction", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.removeEntityVesting(A, { from: treasury })

      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), dec(1, 24));
      await assertRevert(lockedVSTA.transferUnassignedVSTA({ from: user }))
    })

    it("transferUnassignedVSTA: called by owner, Add with 1M then Delete, recover 1M", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.removeEntityVesting(A, { from: treasury })

      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), dec(1, 24));

      const currentBalance = await vstaToken.balanceOf(treasury);
      await lockedVSTA.transferUnassignedVSTA({ from: treasury })
      assert.equal((await vstaToken.balanceOf(treasury)).toString(), currentBalance.add(toBN(dec(1, 24))));
    })

    it("transferUnassignedVSTA: called by owner, Add with 1M + 6 MONTHS + Delete, recover unassigned tokens", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)

      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      assert.equal((await lockedVSTA.getClaimableVSTA(A)).toString(), await applyVestingFormula(entityVestingData));
      await lockedVSTA.removeEntityVesting(A, { from: treasury })

      const toClaimCurrentBlock = await applyVestingFormula(entityVestingData);
      const unAssignedTotal = toBN(dec(1, 24)).sub(toClaimCurrentBlock)

      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), unAssignedTotal.toString())

      const currentBalance = await vstaToken.balanceOf(treasury);
      await lockedVSTA.transferUnassignedVSTA({ from: treasury })
      assert.equal((await vstaToken.balanceOf(treasury)).toString(), currentBalance.add(unAssignedTotal));
    })

    it("Vesting Formula 1M over (6 Months - 1 min), returns 0 claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS.sub(toBN(60)), web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      assert.equal((await lockedVSTA.getClaimableVSTA(A)).toString(), await applyVestingFormula(entityVestingData));
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);

      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed, 0)
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed, 0)
    })

    it("Vesting Formula 1M over 6 Months, returns ~250,000 claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      const claimable = (await lockedVSTA.getClaimableVSTA(A)).toString();
      assert.equal(claimable, await applyVestingFormula(entityVestingData));
      assert.closeTo(th.getDifferenceEther(claimable, dec(250000, 18)), 0, 1000)

      assert.equal((await vstaToken.balanceOf(A)).toString(), 0);
      await lockedVSTA.claimVSTAToken({ from: A });
      const currentBlockClaimData = await applyVestingFormula(entityVestingData)

      assert.equal((await vstaToken.balanceOf(A)).toString(), currentBlockClaimData);
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);

      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed.toString(), currentBlockClaimData)
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed.toString(), 0)
    })

    it("Vesting Formula 1M over 1 Year, returns 500,000 claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(TWO_YEARS.div(toBN(2)), web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      const claimable = (await lockedVSTA.getClaimableVSTA(A)).toString()
      assert.equal(claimable, await applyVestingFormula(entityVestingData))
      assert.closeTo(th.getDifferenceEther(claimable, dec("500000", 18)), 0, 1)


      assert.equal((await vstaToken.balanceOf(A)).toString(), 0);

      await lockedVSTA.claimVSTAToken({ from: A });
      const currentBlockClaimData = await applyVestingFormula(entityVestingData)

      assert.equal((await vstaToken.balanceOf(A)).toString(), currentBlockClaimData);
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);

      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed.toString(), currentBlockClaimData)
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed.toString(), 0)
    })

    it("Vesting Formula 1M over 1.5 Year, returns 750,000 claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(TWO_YEARS.div(toBN(2)).add(SIX_MONTHS), web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      const claimable = (await lockedVSTA.getClaimableVSTA(A)).toString();
      assert.equal(claimable, await applyVestingFormula(entityVestingData));
      assert.closeTo(th.getDifferenceEther(claimable, dec("750000", 18)), 0, 1000)


      assert.equal((await vstaToken.balanceOf(A)).toString(), 0);
      await lockedVSTA.claimVSTAToken({ from: A });
      const currentBlockClaimData = await applyVestingFormula(entityVestingData)

      assert.equal((await vstaToken.balanceOf(A)).toString(), currentBlockClaimData);
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);
      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed.toString(), currentBlockClaimData)
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed.toString(), 0)
    })

    it("Vesting Formula 1M over 2 Year, returns 1M claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(TWO_YEARS, web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      const claimable = (await lockedVSTA.getClaimableVSTA(A)).toString();
      assert.equal(claimable, (await applyVestingFormula(entityVestingData)).toString());
      assert.closeTo(th.getDifferenceEther(claimable, dec(1, 24)), 0, 1000)


      assert.equal((await vstaToken.balanceOf(A)).toString(), 0);
      await lockedVSTA.claimVSTAToken({ from: A });

      assert.equal((await vstaToken.balanceOf(A)).toString(), dec(1, 24));
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);
      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed.toString(), dec(1, 24))
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed.toString(), 0)

      assert.equal((await vstaToken.balanceOf(lockedVSTA.address)).toString(), dec(1, 24))
    })


    it("Vesting Formula 1M over 4 Year, returns 1M claimable, unassign VSTA is 0", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })

      await th.fastForwardTime(TWO_YEARS.mul(toBN(2)), web3.currentProvider)
      const entityVestingData = await lockedVSTA.entitiesVesting(A)

      const claimable = (await lockedVSTA.getClaimableVSTA(A)).toString();
      assert.equal(claimable, (await applyVestingFormula(entityVestingData)).toString());
      assert.closeTo(th.getDifferenceEther(claimable, dec(1, 24)), 0, 1000)


      assert.equal((await vstaToken.balanceOf(A)).toString(), 0);
      await lockedVSTA.claimVSTAToken({ from: A });

      assert.equal((await vstaToken.balanceOf(A)).toString(), dec(1, 24));
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);
      assert.equal((await lockedVSTA.entitiesVesting(A)).claimed.toString(), dec(1, 24))
      assert.equal((await lockedVSTA.entitiesVesting(B)).claimed.toString(), 0)

      assert.equal((await vstaToken.balanceOf(lockedVSTA.address)).toString(), dec(1, 24))
    })


    it("Vesting Formula 1M over 2 Years multiple claiming with deleted Entity in the way", async () => {
      await lockedVSTA.addEntityVesting(A, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(B, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(C, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(D, dec(1, 24), { from: treasury })
      await lockedVSTA.addEntityVesting(E, dec(1, 24), { from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)
      await lockedVSTA.claimVSTAToken({ from: A });
      await lockedVSTA.claimVSTAToken({ from: D });

      await lockedVSTA.removeEntityVesting(C, { from: treasury })
      await lockedVSTA.transferUnassignedVSTA({ from: treasury })

      await th.fastForwardTime(SIX_MONTHS, web3.currentProvider)
      await lockedVSTA.claimVSTAToken({ from: A });
      await lockedVSTA.claimVSTAToken({ from: B });


      await lockedVSTA.removeEntityVesting(D, { from: treasury })
      await lockedVSTA.transferUnassignedVSTA({ from: treasury })

      await lockedVSTA.removeEntityVesting(E, { from: treasury })
      await lockedVSTA.transferUnassignedVSTA({ from: treasury })

      let entityVestingData = await lockedVSTA.entitiesVesting(A)
      let entityVestingData_B = await lockedVSTA.entitiesVesting(B)

      assert.equal((await vstaToken.balanceOf(A)).toString(), (await vstaToken.balanceOf(B)).toString());
      assert.equal(entityVestingData.claimed.toString(), entityVestingData_B.claimed.toString())

      await th.fastForwardTime(TWO_YEARS.sub(SIX_MONTHS.mul(toBN(2))), web3.currentProvider)

      await lockedVSTA.claimVSTAToken({ from: A })
      await lockedVSTA.claimVSTAToken({ from: B })

      assert.equal((await vstaToken.balanceOf(A)).toString(), dec(1, 24));
      assert.equal((await vstaToken.balanceOf(B)).toString(), dec(1, 24));

      assert.equal((await vstaToken.balanceOf(lockedVSTA.address)).toString(), 0)
      assert.equal((await lockedVSTA.getUnassignVSTATokensAmount()).toString(), 0);
    })
  })
})
