const fs = require('fs')

const makeAccount = () => {
  acc = `{ privateKey: "${randomHex()}", balance: "0x21e19e0c9bab2400000" }`
  return acc
}

const randomHex = () => {
  const hexChars = "abcdefABCDEF0123456789"
  let hexCharArray = ["0x"]

  for (i = 0; i < 64; i++) {
    hexCharArray.push(randomChar(hexChars))
  }
  // console.log("hexarray is" + hexCharArray)
  return hexCharArray.join("")
}

const randomChar = (chars) => {
  const len = chars.length
  const idx = Math.floor(len * Math.random())

  return chars[idx]
}

const makeBuidlerAccountsList = (n) => {
  accountsDict = {}
  accounts = []
 
  let i = 0;
  let account;

  while (i < n) {
    console.log(i)
    account = makeAccount()
    // console.log("account is" + account)
    if (Object.keys(accountsDict).includes(account)) {
      i += 1
      continue
    } else {
      accounts.push(account)
      accountsDict[account] = true
      i += 1
    }
  }

  return(
        `const accountsList = \n
        [ ${accounts.join(",\n")} ]\n 
          module.exports = {
          accountsList: accountsList
      };`)
}

// Construct accounts array data
const arrayList = makeBuidlerAccountsList(80000)

// console.log(arrayList)
  fs.appendFile('../accountsList.js', arrayList, (err) => { if (err) console.log(err) })
