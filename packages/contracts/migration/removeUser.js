const fs = require('fs')
const path = require('path');

const {
  OUTPUT_FILE_FULL,
  lqtyAddresses,
} = require('./constants')

const {
  toBigNum,
} = require('./helpers')

const user = lqtyAddresses.bounty.toLowerCase()
const outputFileFull = path.resolve(__dirname, OUTPUT_FILE_FULL)
const usersString = require(outputFileFull)
delete usersString[user]

fs.writeFileSync(outputFileFull, JSON.stringify(usersString))

