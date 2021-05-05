const { TestHelper: { dec, toBN, logBN } }  = require("../../utils/testHelpers.js")
const deploymentHelper = require("../../utils/deploymentHelpers.js")

const { ORIGINAL_DEPLOYMENT_BLOCK_NUMBER, MIGRATION_BLOCK_NUMBER, lqtyAddresses } = require('../constants.js')
const { getUnipoolProgress, getCurveUnipoolProgress } = require('../query.js')

contract('Migration claim', async accounts => {
  let merkleTree
  let merkleDistributor
  let lqtyTokenV2

  before(async () => {
    merkleTree = require('../output/merkleTree.json')
    const migrationTimestamp = (await web3.eth.getBlock(MIGRATION_BLOCK_NUMBER)).timestamp

    const coreContracts = await deploymentHelper.deployLiquityCore()

    const originalDeploymentTime = (await web3.eth.getBlock(ORIGINAL_DEPLOYMENT_BLOCK_NUMBER)).timestamp
    const LQTYContracts = await deploymentHelper.deployLQTYContractsHardhatV2(
      originalDeploymentTime,
      lqtyAddresses.bounty,
      lqtyAddresses.multisig,
      merkleTree
    )
    merkleDistributor = LQTYContracts.merkleDistributor
    lqtyTokenV2 = LQTYContracts.lqtyToken

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCoreV2(LQTYContracts, coreContracts, migrationTimestamp)

    // transfer
    const unipoolProgress = await getUnipoolProgress()
    const curveUnipoolProgress = await getCurveUnipoolProgress()
    const merkleDistributorAmount = curveUnipoolProgress.rewarded .add(unipoolProgress.rewarded)
    logBN('merkleDistributorAmount', merkleDistributorAmount)
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [lqtyAddresses.bounty]
    })
    logBN('bounty bal', await lqtyTokenV2.balanceOf(lqtyAddresses.bounty))
    await lqtyTokenV2.transfer(merkleDistributor.address, merkleDistributorAmount, { from: lqtyAddresses.bounty })
    logBN('bounty bal', await lqtyTokenV2.balanceOf(lqtyAddresses.bounty))
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [lqtyAddresses.bounty]
    })

    const merkleBalance = await lqtyTokenV2.balanceOf(merkleDistributor.address)
    logBN('merkleBalance', merkleBalance)
  })

  const claim = async (user) => {
    // get claim
    const claim = merkleTree.claims[web3.utils.toChecksumAddress(user)]
    //logBN('amount', web3.utils.hexToNumberString(claim.amount))
    // claim
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [user]
    })
    await merkleDistributor.claim(claim.index, user, claim.amount, claim.proof, { from: user })
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [user]
    })
    assert.equal((await lqtyTokenV2.balanceOf(user)).toString(), web3.utils.hexToNumberString(claim.amount))

    return toBN(web3.utils.hexToNumberString(claim.amount))
  }

  it('can claim', async () => {
    const balances = require('../output/migrationBalances.json')
    console.log(`Number of accounts: ${Object.keys(balances).length}`)
    const balancesTotal = Object.keys(balances).reduce((t, user) => t.add(toBN('0x' + balances[user])), toBN(0))
    logBN('Total account balances', balancesTotal)
    logBN('Total Mekle tree      ', toBN(merkleTree.tokenTotal))

    let i = 0
    let total = toBN(0)
    for (const user in balances) {
      //console.log(i++, user)
      const amount = await claim(user)
      total = total.add(amount)
      //logBN('Claimed so far', total)
    }
    logBN('Total claimed', total)
  })
})
