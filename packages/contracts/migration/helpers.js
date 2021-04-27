const { ethers } = require("ethers")

const toBigNum = ethers.BigNumber.from
const decToBn = dec => {
  const splitDec = dec.split('.')
  if (splitDec.length == 1) return toBigNum(dec).mul(toBigNum('1000000000000000000'))
  return toBigNum(splitDec[0] + splitDec[1].padEnd(18, '0'))
}

const dec = (value, zeros, decimal= '0') => value.toString() + decimal.repeat(zeros)

const logBN = (label, x) => {
  x = x.toString().padStart(18, '0')
  // TODO: thousand separators
  const integerPart = x.slice(0, x.length-18) ? x.slice(0, x.length-18) : '0'
  console.log(`${label}:`.padEnd(30, ' '), integerPart.padStart(9, ' ') + '.' + x.slice(-18))
}

const logUser = user => {
  Object.keys(user).map(k => console.log(k.padEnd(20, ' '), user[k].toString()))
  /*
  console.log('balance:   ', user.balance.toString())
  console.log('stake:     ', user.stake.toString())
  console.log('depo gain: ', user.depositorLQTYGain.toString())
  console.log('fe gain:   ', user.frontEndLQTYGain.toString())
  console.log('total:     ', user.total.toString())
  */
}

const logUsers = users => Object.keys(users).map(user => logUser(users[user]))

const logUserAggregates = users => {
  console.log('\n User aggregate balances:')
  const aggregates = {}
  Object.keys(users[Object.keys(users)[0]]).map(
    k => aggregates[k] = Object.keys(users).reduce((t, u) => t.add(users[u][k]), toBigNum(0))
  )
  Object.keys(aggregates).map(k => logBN(k, aggregates[k]))

  return aggregates
}

const logBalances = (balances, title='') => {
  let total = toBigNum(0)
  console.log(`\n ${title} contract balances:`)
  Object.keys(balances).map(contract => {
    if (balances[contract] != '0') {
      logBN(contract, balances[contract])
      total = total.add(toBigNum(balances[contract]))
    }
  })
  logBN('Total', total)

  return total
}

const usersToString = (users) => {
  const usersToString = {}

  Object.keys(users).map(userAddress => {
    const user = users[userAddress]
    const newUser = {}
    Object.keys(user).map(k => newUser[k] = toBigNum(user[k]).toString())
    usersToString[userAddress] = newUser
  })

  return usersToString
}

const usersToBn = (users) => {
  const usersToBn = {}

  Object.keys(users).map(userAddress => {
    const user = users[userAddress]
    const newUser = {}
    Object.keys(user).map(k => newUser[k] = toBigNum(user[k]))
    usersToBn[userAddress] = newUser
  })

  return usersToBn
}

module.exports = {
  toBigNum,
  decToBn,
  dec,
  logBN,
  logUser,
  logUsers,
  logUserAggregates,
  logBalances,
  usersToString,
  usersToBn,
}
