const fs = require('fs')
const assert = require('assert')

//const ApolloClient = require("apollo-boost")
const ApolloBoost = require('apollo-boost')
const ApolloClient = ApolloBoost.default
const gql = require('graphql-tag')
const fetch = require('cross-fetch')

const { ethers } = require("ethers")

const {
  GRAPH_URL,
  PAGINATION,
  MIGRATION_BLOCK_NUMBER,
  lqtyAddresses,
  LOCKUP_CONTRACTS,
  UNIPOOL_BLOCK_NUMBERS,
  UNIPOOL_ALLOCATION,
  UNIPOOL_PERIOD,
  CURVE_UNIPOOL_BLOCK_NUMBER,
  CURVE_UNIPOOL_ALLOCATION,
  CURVE_UNIPOOL_PERIOD,
} = require('./constants')

const {
  toBigNum,
  decToBn,
  dec,
  logBN,
} = require('./helpers')

const client = new ApolloClient({
  uri: GRAPH_URL,
  fetch
});

// TODO: pagination
const usersQuery = gql`
    query Users($lastID: String) {
      users(first: ${PAGINATION}, where: {id_gt: $lastID}, block: { number: ${MIGRATION_BLOCK_NUMBER} }) {
        id
        stake {
          amount
        }
        stabilityDeposit {
          depositedAmount
        }
        balances {
          token {
            symbol
          }
          balance
        }
      }
    }
  `
const getSecret = (secretKey, defaultValue='') => {
  const SECRETS_FILE = "./secrets.js"
  let secret = defaultValue
  if (fs.existsSync(SECRETS_FILE)) {
    const { secrets } = require('.' + SECRETS_FILE)
    if (secrets[secretKey]) { secret = secrets[secretKey] }
  }

  return secret
}

//const provider = ethers.getDefaultProvider('homestead', { alchemy: getSecret('alchemyAPIKey') })
const provider = new ethers.providers.AlchemyProvider("homestead", getSecret('alchemyAPIKey'));

const blacklistedAddresses = [
  ...Object.values(lqtyAddresses),
  ...LOCKUP_CONTRACTS
].map(c => c.toLowerCase())
//console.log('blacklistedAddresses: ', blacklistedAddresses)

// LQTY token
const { abi: lqtyTokenAbi } = require("../build/contracts/LQTYToken.json")
const lqtyToken = new ethers.Contract(lqtyAddresses.lqtyToken, lqtyTokenAbi, provider)
// LQTY staking
const { abi: lqtyStakingAbi } = require("../build/contracts/LQTYStaking.json")
const lqtyStaking = new ethers.Contract(lqtyAddresses.lqtyStaking, lqtyStakingAbi, provider)
// Stability Pool
const { abi: stabilityPoolAbi } = require("../build/contracts/StabilityPool.json")
const stabilityPool = new ethers.Contract(lqtyAddresses.stabilityPool, stabilityPoolAbi, provider)
// Unipool
const { abi: unipoolAbi } = require("../build/contracts/Unipool.json")
const unipool = new ethers.Contract(lqtyAddresses.unipool, unipoolAbi, provider)
// Curve Unipool
// staking tokens are all owned by Curve Gauge contract
const { abi: curveUnipoolAbi } = require("./abi/StakingRewards.json")
const curveUnipool = new ethers.Contract(lqtyAddresses.curveUnipool, curveUnipoolAbi, provider)
const { abi: curveGaugeAbi } = require("./abi/LiquidityGaugeV2.json")
const curveGauge = new ethers.Contract(lqtyAddresses.curveGauge, curveGaugeAbi, provider)
// UniswapPool
const { abi: uniswapPoolAbi } = require("./abi/UniswapV2Pair.json")
const uniswapPool = new ethers.Contract(lqtyAddresses.uniswapLqtyPool, uniswapPoolAbi, provider)

const getLQTYGainFromStabilityPool = async (userAddress, user) => {
  const depositorLQTYGain = await stabilityPool.getDepositorLQTYGain(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('depositorLQTYGain: ', depositorLQTYGain.toString())
  user.depositorLQTYGain = depositorLQTYGain
  const frontEndLQTYGain = await stabilityPool.getFrontEndLQTYGain(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('frontEndLQTYGain: ', frontEndLQTYGain.toString())
  user.frontEndLQTYGain = frontEndLQTYGain
}

/*
const getLQTYStaked = async (userAddress, user) => {
  const stakedLQTY = await lqtyStaking.stakes(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('stakedLQTY: ', stakedLQTY.toString())
  user.stakedLQTY = stakedLQTY
}
*/

const getUnipoolBalance = async (userAddress, user) => {
  const earned = await unipool.earned(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('earned: ', earned.toString())
  user.unipoolEarned = earned
}

const getCurveUnipoolBalance = async (userAddress, user) => {
  //const earned = await curveUnipool.earned(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('earned: ', earned.toString())
  const earned = await curveGauge.claimable_reward(userAddress, lqtyAddresses.lqtyToken, { blockTag: MIGRATION_BLOCK_NUMBER })
  user.curveUnipoolEarned = earned
}

const getUniswapPoolBalance = async (userAddress, user, { uniswapPoolTotalSupply, uniswapPoolLQTYReserve }) => {
  const balance = await uniswapPool.balanceOf(userAddress, { blockTag: MIGRATION_BLOCK_NUMBER })
  //console.log('balance: ', balance.toString())
  user.uniswapPoolBalance = balance.mul(uniswapPoolLQTYReserve).div(uniswapPoolTotalSupply)
}

const processQuery = async (users, lastID, { uniswapPoolTotalSupply, uniswapPoolLQTYReserve }) => {
  console.log('lastID: ', lastID)
  const subgraphData = await client.query({ query: usersQuery, variables: { lastID } })
  const inputData = subgraphData.data.users
  console.log('inputData.length: ', inputData.length)
  //console.log(inputData)
  for (const i in inputData) {
    const user = inputData[i]
    if (blacklistedAddresses.includes(user.id.toLowerCase())) { continue; }
    const lqty = user.balances.filter(b => b.token.symbol === 'LQTY')[0]
    const lqtyBalance = lqty ? toBigNum(lqty.balance) : toBigNum('0')
    users[user.id] = {
      balance: lqtyBalance,
      stake: user.stake ? decToBn(user.stake.amount) : toBigNum('0'),
    }

    await getLQTYGainFromStabilityPool(user.id, users[user.id])
    //await getLQTYStaked(user.id, users[user.id])
    await getUnipoolBalance(user.id, users[user.id])
    await getCurveUnipoolBalance(user.id, users[user.id])
    await getUniswapPoolBalance(user.id, users[user.id], { uniswapPoolTotalSupply, uniswapPoolLQTYReserve })

    // compute total
    users[user.id].total = Object.keys(users[user.id]).reduce((t, k) => t.add(users[user.id][k]), toBigNum(0))
    //logUser(users[user.id])
  }
  console.log('users.length: ', Object.keys(users).length)

  lastID = inputData.length > 0 ? inputData[inputData.length - 1].id : ""

  return { lastID, size: inputData.length }
}

const queryBalances = async () => {
  const users = {}

  const initTimestamp = Date.now()
  console.log('Start:', (new Date()).toUTCString())

  const uniswapPoolTotalSupply = await uniswapPool.totalSupply({ blockTag: MIGRATION_BLOCK_NUMBER })
  const uniswapPoolLQTYReserve = (await uniswapPool.getReserves({ blockTag: MIGRATION_BLOCK_NUMBER }))._reserve0

  let lastID = ""
  let size = PAGINATION
  while (size >= PAGINATION) {
    const result = await processQuery(users, lastID, { uniswapPoolTotalSupply, uniswapPoolLQTYReserve })
    ;({ lastID, size } = result)
    console.log('users.length: ', Object.keys(users).length)
    console.log(`Ellapsed: ${Math.floor((Date.now() - initTimestamp) / 60000)} min`)
  }

  console.log('End:', (new Date()).toUTCString())

  return users
}

const getLqtyBalances = async () => {
  const lqtyBalances = {}
  await Promise.all(
    Object.keys(lqtyAddresses).map(async (contract) =>
      lqtyBalances[contract] = await lqtyToken.balanceOf(lqtyAddresses[contract], { blockTag: MIGRATION_BLOCK_NUMBER })
    )
  )

  return lqtyBalances
}

const getLockupBalances = async () => {
  const lockupBalances = {}
  await Promise.all(
    LOCKUP_CONTRACTS.map(async (address) =>
      lockupBalances[address] = await lqtyToken.balanceOf(address, { blockTag: MIGRATION_BLOCK_NUMBER })
    )
  )

  return lockupBalances
}

const getRewardsProgress = async (rewardsContract, allocation, startTime, period) => {
  const endTime = await rewardsContract.periodFinish({ blockTag: MIGRATION_BLOCK_NUMBER })
  const rewardsPeriod = endTime - startTime
  assert(rewardsPeriod === period, 'Period doesn’t match')

  const migrationTime = (await provider.getBlock(MIGRATION_BLOCK_NUMBER)).timestamp
  const ellapsedPeriod = Math.max(migrationTime - startTime, 0)

  const allocationBN = toBigNum(allocation)

  const rewarded = allocationBN.mul(toBigNum(ellapsedPeriod)).div(toBigNum(rewardsPeriod))
  const remaining = allocationBN.sub(rewarded)

  return { rewarded, remaining }
}

const getUnipoolProgress = async () => {
  const firstStakeTime = (await provider.getBlock(UNIPOOL_BLOCK_NUMBERS.FIRST_STAKE)).timestamp
  const firstWithdrawTime = (await provider.getBlock(UNIPOOL_BLOCK_NUMBERS.FIRST_WITHDRAW)).timestamp
  const secondStakeTime = (await provider.getBlock(UNIPOOL_BLOCK_NUMBERS.SECOND_STAKE)).timestamp
  return getRewardsProgress(unipool, UNIPOOL_ALLOCATION, firstStakeTime + secondStakeTime - firstWithdrawTime, UNIPOOL_PERIOD)
}

const getCurveUnipoolProgress = async () => {
  const startTime = (await provider.getBlock(CURVE_UNIPOOL_BLOCK_NUMBER)).timestamp
  return getRewardsProgress(curveUnipool, CURVE_UNIPOOL_ALLOCATION, startTime, CURVE_UNIPOOL_PERIOD)
}

module.exports = {
  queryBalances,
  getLqtyBalances,
  getLockupBalances,
  getUnipoolProgress,
  getCurveUnipoolProgress,
}
