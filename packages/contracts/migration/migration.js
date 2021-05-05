const fs = require('fs')
const path = require('path')
const assert = require('assert')

const {
  OUTPUT_FILE,
  OUTPUT_FILE_FULL,
  OUTPUT_FILE_LQTY,
  OUTPUT_FILE_LOCKUP,
  CI_ALREADY_ISSUED,
} = require('./constants')

const {
  queryBalances,
  getLqtyBalances,
  getLockupBalances,
  getUnipoolProgress,
  getCurveUnipoolProgress,
} = require('./query')

const {
  toBigNum,
  dec,
  logBN,
  logUsers,
  logUserAggregates,
  logBalances,
  usersToString,
  usersToBn,
} = require('./helpers')
//const { TestHelper: { logBN } } = require('../utils/testHelpers.js')


;(async function() {
  let users

  const outputFileFull = path.resolve(__dirname, OUTPUT_FILE_FULL)
  if (fs.existsSync(outputFileFull)) {
    const usersString = require(outputFileFull)
    users = usersToBn(usersString)
  } else {
    users = await queryBalances()
    const usersString = usersToString(users)
    fs.writeFileSync(outputFileFull, JSON.stringify(usersString))
  }

  const outputFile = path.resolve(__dirname, OUTPUT_FILE)
  if (!fs.existsSync(outputFile)) {
    const usersOutput = {}
    Object.keys(users).map(user => {
      if (!users[user].total.eq(toBigNum(0))) {
        (usersOutput[user] = users[user].total.toHexString().slice(2)) // hex without '0x'
      }
    })
    fs.writeFileSync(outputFile, JSON.stringify(usersOutput))
  }

  //logUsers(users)
  const aggregates = logUserAggregates(users)
  const usersTotal = Object.keys(users).reduce((t, user) => t.add(users[user].total), toBigNum(0))

  logBN('Users Total', usersTotal)
  // Merkle distributor
  const unipoolProgress = await getUnipoolProgress()
  const curveUnipoolProgress = await getCurveUnipoolProgress()
  const merkleDistributorAmount = curveUnipoolProgress.rewarded .add(unipoolProgress.rewarded).add(toBigNum(CI_ALREADY_ISSUED))
  logBN('Merkle distr. bal.', merkleDistributorAmount)

  // Rewards progress
  console.log('\n')
  logBN('Uniswap rewarded', unipoolProgress.rewarded)
  logBN('Uniswap remaining', unipoolProgress.remaining)
  logBN('Curve rewarded', curveUnipoolProgress.rewarded)
  logBN('Curve remaining', curveUnipoolProgress.remaining)

  // LQTY contract balances
  let lqtyBalances = {}

  const outputFileLqty = path.resolve(__dirname, OUTPUT_FILE_LQTY)
  if (fs.existsSync(outputFileLqty)) {
    const lqtyBalancesString = require(outputFileLqty)
    Object.keys(lqtyBalancesString).map(contract => {
      lqtyBalances[contract] = toBigNum(lqtyBalancesString[contract])
    })
  } else {
    lqtyBalances = await getLqtyBalances()
    const lqtyBalancesString = {}
    Object.keys(lqtyBalances).map(contract => {
      lqtyBalancesString[contract] = lqtyBalances[contract].toString()
    })
    fs.writeFileSync(outputFileLqty, JSON.stringify(lqtyBalancesString))
  }

  logBalances(lqtyBalances, 'LQTY')
  logBN('CI already issued', CI_ALREADY_ISSUED)

  // Lockup contract balances
  let lockupBalances = {}

  const outputFileLockup = path.resolve(__dirname, OUTPUT_FILE_LOCKUP)
  if (fs.existsSync(outputFileLockup)) {
    lockupBalances = require(outputFileLockup)
  } else {
    const lockupBalancesBigNum = await getLockupBalances()
    Object.keys(lockupBalancesBigNum).map(contract => {
      lockupBalances[contract] = lockupBalancesBigNum[contract].toString()
    })
    fs.writeFileSync(outputFileLockup, JSON.stringify(lockupBalances))
  }

  const lockupTotal = logBalances(lockupBalances, 'Lockup')

  // Checks
  console.log('\n---\n')

  // LQTY staking
  assert(lqtyBalances.lqtyStaking.toString() === aggregates.stake.toString(), 'LQTY staking balance doesn’t match')
  // Multisig + lockups
  logBN('ms + lockups', lqtyBalances.multisig.add(lockupTotal))
  logBN('ms exp', toBigNum('64' + '6'.repeat(23) + '7'))
  // TODO
  /*
  assert(
    lqtyBalances.multisig.add(lockupTotal).toString()
      ===
      '64' + '6'.repeat(23) + '7', // 64.6...M
    'Lockup contract balances don’t match'
  )
  */
  // Community issuance
  const initialCI = toBigNum('32' + '0'.repeat(24)) // 32M
  logBN('CI', lqtyBalances.communityIssuance.add(toBigNum(CI_ALREADY_ISSUED)))
  logBN('SP gains', initialCI.add(aggregates.depositorLQTYGain).add(aggregates.frontEndLQTYGain))
  // TODO
  /*
  assert(
    lqtyBalances.communityIssuance
      .add(toBigNum(CI_ALREADY_ISSUED))
      .toString()
      ===
      initialCI
      .add(aggregates.depositorLQTYGain)
      .add(aggregates.frontEndLQTYGain)
      .toString(),
    'Community Issuance balance doesn’t match'
  )
  */

  // LP rewards
  /*
    assert(
    lqtyBalances.unipool.sub(aggregates.unipoolEarned).toString()
    ===
    unipoolProgress.remaining,
    'Remaining Unipool balance doesn’t match'
    )
  */
  /*
    assert(
    lqtyBalances.curveUnipool.add(lqtyBalances.curveGauge).sub(aggregates.curveUnipoolEarned).toString()
    ===
    curveUnipoolProgress.remaining,
    'Remaining CurveUnipool balance doesn’t match'
    )
  */

  // Merkle distributor
  assert(
    merkleDistributorAmount.toString()
      ===
    usersTotal
      .add(lqtyBalances.curveUnipool)
      .add(lqtyBalances.unipool)
      .sub(aggregates.unipoolEarned)
      .toString(),
    'Merkle distributon balance doesn’t match'
  )
})();
