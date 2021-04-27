const fs = require('fs')
const { ethers } = require("ethers")
const toBigNum = ethers.BigNumber.from

const BASE_FILE_NAME = 'migrationBalances'
const OUTPUT_FILE = `./${BASE_FILE_NAME}Sorted.json`

const users = require(`../${BASE_FILE_NAME}.json`)

const usersSorted = Object.keys(users).map(u => {
  const userObj = {
    user: u,
    balance: users[u],
  }
  return userObj
}).sort((a, b) => toBigNum(b.balance).sub(toBigNum(a.balance)).div(toBigNum(1e12)).toNumber())

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(usersSorted))
