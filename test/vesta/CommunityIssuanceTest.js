const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const StabilityPool = artifacts.require('StabilityPool.sol')

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN

contract('CommunityIssuance', async accounts => {
  const ZERO_ADDRESS = th.ZERO_ADDRESS
  const assertRevert = th.assertRevert
  const DECIMAL_PRECISION = toBN(dec(1, 18))
  const [owner, user, A, C, B, multisig, treasury] = accounts;
  const timeValues = testHelpers.TimeValues

  let communityIssuance
  let stabilityPool
  let stabilityPoolERC20
  let vstaToken
  let erc20

  describe("Community Issuance", async () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      const VSTAContracts = await deploymentHelper.deployVSTAContractsHardhat(treasury)

      vstaToken = VSTAContracts.vstaToken
      communityIssuance = VSTAContracts.communityIssuance
      erc20 = contracts.erc20;

      await deploymentHelper.connectCoreContracts(contracts, VSTAContracts)
      await deploymentHelper.connectVSTAContractsToCore(VSTAContracts, contracts, true)

      await contracts.adminContract.addNewCollateral(ZERO_ADDRESS, contracts.stabilityPoolTemplate.address, ZERO_ADDRESS, ZERO_ADDRESS, '0', 0, 0)
      await contracts.adminContract.addNewCollateral(erc20.address, contracts.stabilityPoolTemplate.address, ZERO_ADDRESS, ZERO_ADDRESS, '0', 0, 0)

      stabilityPool = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(ZERO_ADDRESS))
      stabilityPoolERC20 = await StabilityPool.at(await contracts.stabilityPoolManager.getAssetStabilityPool(erc20.address));
      await communityIssuance.transferOwnership(treasury);
      await VSTAContracts.vstaToken.approve(VSTAContracts.communityIssuance.address, ethers.constants.MaxUint256, { from: treasury });
    })

    it("Owner(): Contract has been initialized, owner should be the treasury", async () => {
      assert.equal(await communityIssuance.owner(), treasury)
    })

    it("addFundToStabilityPool: Called by owner, invalid SP then invalid supply, revert transaction", async () => {
      const balance = await vstaToken.balanceOf(treasury);

      await assertRevert(communityIssuance.addFundToStabilityPool(communityIssuance.address, dec(100, 18), { from: treasury }))
      await assertRevert(communityIssuance.addFundToStabilityPool(stabilityPool.address, balance.add(toBN(1)), { from: treasury }))
    })

    it("addFundToStabilityPool: Called by user, valid inputs, revert transaction", async () => {
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, dec(100, 18), { from: treasury })
      await assertRevert(communityIssuance.addFundToStabilityPool(stabilityPool.address, dec(100, 18), { from: user }))
    })

    it("addFundToStabilityPool: Called by owner, valid inputs, add stability pool", async () => {
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, dec(100, 18), { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, dec(100, 18), { from: treasury })
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), dec(100, 18))
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), dec(100, 18))
    })

    it("addFundToStabilityPool: Called by owner twice, double total supply, don't change deploy time", async () => {
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, dec(100, 18), { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, dec(100, 18), { from: treasury })

      const deployTimePool = await communityIssuance.lastUpdateTime(stabilityPool.address);
      const deployTimePoolERC20 = await communityIssuance.lastUpdateTime(stabilityPoolERC20.address);

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_DAY, web3.currentProvider)

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, dec(100, 18), { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, dec(100, 18), { from: treasury })

      const deployTimePoolAfter = await communityIssuance.lastUpdateTime(stabilityPool.address);
      const deployTimePoolAfterERC20 = await communityIssuance.lastUpdateTime(stabilityPoolERC20.address);

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), dec(200, 18))
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), dec(200, 18))
      assert.equal(deployTimePool.toString(), deployTimePoolAfter.toString())
      assert.equal(deployTimePoolERC20.toString(), deployTimePoolAfterERC20.toString())
    })

    it("addFundToStabilityPool: Called by owner, valid inputs, change total supply", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), supply.mul(toBN(2)))
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), supply)
    })

    it("removeFundFromStabilityPool: Called by user, valid inputs, then reverts", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await assertRevert(communityIssuance.removeFundFromStabilityPool(stabilityPool.address, dec(50, 18), { from: user }))
    })


    it("removeFundFromStabilityPool: Called by owner, invalid inputs, then reverts", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await assertRevert(communityIssuance.removeFundFromStabilityPool(stabilityPool.address, dec(101, 18), { from: treasury }))
    })

    it("removeFundFromStabilityPool: Called by owner, valid amount, then remove from supply and give to caller", async () => {
      const supply = toBN(dec(100, 18))
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })

      const beforeBalance = await vstaToken.balanceOf(communityIssuance.address);
      const beforeBalanceTreasury = await vstaToken.balanceOf(treasury);

      await communityIssuance.removeFundFromStabilityPool(stabilityPool.address, dec(50, 18), { from: treasury })
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), dec(50, 18))
      assert.equal((await vstaToken.balanceOf(communityIssuance.address)).toString(), beforeBalance.sub(toBN(dec(50, 18))))
      assert.equal((await vstaToken.balanceOf(treasury)).toString(), beforeBalanceTreasury.add(toBN(dec(50, 18))).toString())
    })


    it("removeFundFromStabilityPool: Called by owner, max supply, then disable pool", async () => {
      const supply = toBN(dec(100, 18))
      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.removeFundFromStabilityPool(stabilityPool.address, supply, { from: treasury })

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.lastUpdateTime(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.totalVSTAIssued(stabilityPool.address)).toString(), 0)
    })

    it("transferFundToAnotherStabilityPool : Called by user, valid inputs, revert transaction", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await assertRevert(communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, dec(50, 18), { from: user }))
    })

    it("transferFundToAnotherStabilityPool : Called by owner, invalid target then invalid receiver, revert transaction", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await assertRevert(communityIssuance.transferFundToAnotherStabilityPool(communityIssuance.address, stabilityPoolERC20.address, dec(50, 18), { from: treasury }))
      await assertRevert(communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, communityIssuance.address, dec(50, 18), { from: treasury }))
    })

    it("transferFundToAnotherStabilityPool : Called by owner, valid pools, quantity over cap, revert transaction", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await assertRevert(communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, supply.add(toBN(1)), { from: treasury }))
    })

    it("transferFundToAnotherStabilityPool : Called by owner, valid pools, issuedVSTA, transfer over caps, revert transaction", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)
      await communityIssuance.unprotectedIssueVSTA(stabilityPool.address)

      const issued = await communityIssuance.totalVSTAIssued(stabilityPool.address);
      const gapsOverByOne = supply.sub(issued).add(toBN(1))

      await assertRevert(communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, gapsOverByOne, { from: treasury }))
    })

    it("transferFundToAnotherStabilityPool : Called by owner, valid inputs, 50% balance, transfer VSTA", async () => {
      const supply = toBN(dec(100, 18))
      const supplyTransfered = supply.div(toBN(2))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, supplyTransfered, { from: treasury })

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), supplyTransfered)
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), supply.add(supplyTransfered))
    })

    it("transferFundToAnotherStabilityPool : Called by owner, valid inputs, 100% balance, transfer VSTA and close pool", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)
      await communityIssuance.unprotectedIssueVSTA(stabilityPool.address)

      const issued = await communityIssuance.totalVSTAIssued(stabilityPool.address);
      const lefOver = supply.sub(issued)

      await communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, lefOver, { from: treasury })

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.lastUpdateTime(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.totalVSTAIssued(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), supply.add(lefOver))
    })


    it("transferFundToAnotherStabilityPool : Called by owner, valid inputs, issued VSTA, 100% left over, transfer VSTA and close pool", async () => {
      const supply = toBN(dec(100, 18))

      await communityIssuance.addFundToStabilityPool(stabilityPool.address, supply, { from: treasury })
      await communityIssuance.addFundToStabilityPool(stabilityPoolERC20.address, supply, { from: treasury })

      await communityIssuance.transferFundToAnotherStabilityPool(stabilityPool.address, stabilityPoolERC20.address, supply, { from: treasury })

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.lastUpdateTime(stabilityPool.address)).toString(), 0)
      assert.equal((await communityIssuance.totalVSTAIssued(stabilityPool.address)).toString(), 0)

      assert.equal((await communityIssuance.VSTASupplyCaps(stabilityPoolERC20.address)).toString(), supply.add(supply))
    })
  })
})
