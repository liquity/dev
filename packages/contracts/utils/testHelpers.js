const getDifference = (_BN, numberString) => {
  return Number(_BN.sub(web3.utils.toBN(numberString)).abs())
}

module.exports = {
  getDifference: getDifference
}