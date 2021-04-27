const fs = require('fs')
const path = require('path');

const {
  OUTPUT_FILE_FULL,
} = require('./constants')

const {
  toBigNum,
} = require('./helpers')

const outputFileFull = path.resolve(__dirname, OUTPUT_FILE_FULL)
const usersString = require(outputFileFull)
Object.keys(usersString).map(user => {
  delete usersString[user].stakedLQTY
  // compute total
  delete usersString[user].total
  usersString[user].total = Object.keys(usersString[user]).reduce((t, k) => t.add(toBigNum(usersString[user][k])), toBigNum(0)).toString()
})

fs.writeFileSync(outputFileFull, JSON.stringify(usersString))

