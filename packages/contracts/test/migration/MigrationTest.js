const Decimal = require("decimal.js");
const { BNConverter } = require("../../utils/BNConverter.js")
const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const { TestHelper: th, MoneyValues: mv, TimeValues: timeValues } = testHelpers
const { dec, toBN, assertRevert } = th

const LQTYToken = artifacts.require("LQTYToken.sol")
const CommunityIssuanceV2 = artifacts.require("CommunityIssuanceV2.sol")
const MerkleDistributor = artifacts.require("MerkleDistributor")

contract('Migration', async accounts => {
  const [bountyAddress, lpRewardsAddress, multisigAddress] = accounts.slice(997, 1000)

  let communityIssuance

  let communityIssuanceV2
  let merkleDistributor
  let lqtyTokenNew

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore()

    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress)

    communityIssuance = LQTYContracts.communityIssuance

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)
  })

  const migrate = async (timeAfter, balances, merkleTree) => {
    // move time forward
    await th.fastForwardTime(timeAfter, web3.currentProvider)

    const coreContracts = await deploymentHelper.deployLiquityCore()
    const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress)
    const originalDeploymentTime = await communityIssuance.deploymentTime()
    console.log('originalDeploymentTime: ', originalDeploymentTime.toString())
    communityIssuanceV2 = await CommunityIssuanceV2.new(originalDeploymentTime)
    LQTYContracts.communityIssuance = communityIssuanceV2
    lqtyTokenNew = await LQTYToken.new(
      communityIssuanceV2.address,
      LQTYContracts.lqtyStaking.address,
      LQTYContracts.lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    LQTYContracts.lqtyToken = lqtyTokenNew
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await LQTYContracts.lqtyStaking.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.lusdToken.address,
      coreContracts.troveManager.address,
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )

    const migrationTimestamp = originalDeploymentTime.add(toBN(timeAfter))
    // Merkle distributor
    console.log('merkleTree.merkleRoot: ', merkleTree.merkleRoot)
    merkleDistributor = await MerkleDistributor.new(LQTYContracts.lqtyToken.address, merkleTree.merkleRoot)
    await communityIssuanceV2.setParams(
      LQTYContracts.lqtyToken.address,
      coreContracts.stabilityPool.address,
      merkleDistributor.address,
      migrationTimestamp
    )

    const communityIssuanceV2LQTYBalance = await lqtyTokenNew.balanceOf(communityIssuanceV2.address)
    const merkleDistributorLQTYBalance = await lqtyTokenNew.balanceOf(merkleDistributor.address)
    const LQTYSupplyCap = await communityIssuanceV2.LQTYSupplyCap()
    assert.equal(LQTYSupplyCap.toString(), dec(32, 24)) // 32M
    assert.equal(communityIssuanceV2LQTYBalance.add(merkleDistributorLQTYBalance).toString(), LQTYSupplyCap.toString())
    const ISSUANCE_FACTOR = await communityIssuanceV2.ISSUANCE_FACTOR()
    assert.equal(ISSUANCE_FACTOR.toString(), '999998681227695000')
    const decimalIssuanceFactor = BNConverter.makeDecimal(ISSUANCE_FACTOR, 18)
    const powerResult = BNConverter.makeBN18(Decimal.pow(decimalIssuanceFactor, timeAfter / 60).toFixed(18))
    console.log('timeAfter: ', timeAfter / 60)
    console.log('BNConverter.makeDecimal(ISSUANCE_FACTOR): ', decimalIssuanceFactor)
    console.log('pow: ', Decimal.pow(decimalIssuanceFactor, timeAfter / 60))
    console.log('pow: ', Decimal.pow(decimalIssuanceFactor, timeAfter / 60).toFixed(18))
    console.log('powR: ', powerResult.toString())
    console.log('diff: ', mv._1e18BN.sub(powerResult).toString())
    const expectedCIBalance = LQTYSupplyCap.mul(powerResult).div(mv._1e18BN)
    const expectedMDBalance = LQTYSupplyCap.mul(mv._1e18BN.sub(powerResult)).div(mv._1e18BN)
    console.log('sum: ', expectedCIBalance.add(expectedMDBalance).toString())
    console.log('CIV2LQTYBalance: ', communityIssuanceV2LQTYBalance.toString())
    console.log('expectedBalance: ', expectedCIBalance.toString())
    console.log('   mdLQTYBalance: ', merkleDistributorLQTYBalance.toString())
    console.log(' expectedBalance: ', expectedMDBalance.toString())
    th.assertIsApproximatelyEqual(communityIssuanceV2LQTYBalance, expectedCIBalance, 1e12) // 1e-6 error over millions sounds about right
    th.assertIsApproximatelyEqual(merkleDistributorLQTYBalance, expectedMDBalance, 1e12)

    // hex to dec string
    const decimalBalances = {}
    Object.keys(balances).map(holder => decimalBalances[holder] = toBN('0x'+balances[holder]).toString())
    //console.log('balances: ', decimalBalances)
    const balancesSum = Object.keys(decimalBalances).reduce((t, k) => t.add(toBN(decimalBalances[k])), toBN(0))
    console.log('             sum: ', balancesSum.toString())
    console.log('             dif: ', merkleDistributorLQTYBalance.sub(balancesSum).toString())
    assert.equal(balancesSum.toString(), merkleDistributorLQTYBalance.toString())
    //console.log(merkleTree.claims)
    for (const holder in decimalBalances) {
      const claim = merkleTree.claims[web3.utils.toChecksumAddress(holder)]
      await merkleDistributor.claim(claim.index, holder, decimalBalances[holder], claim.proof)
      assert.equal((await lqtyTokenNew.balanceOf(holder)).toString(), toBN(decimalBalances[holder]).toString())
    }
  }

  it('Merkle distributor receives the correct amount after 1 month', async () => {
    // 1 months
    const balances = require('./migrationBalances_1month.json')
    const merkleTree = require('./merkleTree_1month.json')
    await migrate(timeValues.SECONDS_IN_ONE_MONTH * 1, balances, merkleTree)
  })

  it('Merkle distributor receives the correct amount after 2 months', async () => {
    // 2 months
    const balances = require('./migrationBalances_2months.json')
    const merkleTree = require('./merkleTree_2months.json')
    await migrate(timeValues.SECONDS_IN_ONE_MONTH * 2, balances, merkleTree)
  })
})
