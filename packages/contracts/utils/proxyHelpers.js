const { TestHelper: th } = require("../utils/testHelpers.js")

const DSProxyFactory = artifacts.require('DSProxyFactoryWrapper')
const DSProxy = artifacts.require('DSProxyWrapper')

const buildUserProxies = async (users) => {
  const proxies = {}
  const proxyFactory = await DSProxyFactory.new()
  for(let user of users) {
    const proxyTx = await proxyFactory.build({ from: user })
    proxies[user] = await DSProxy.at(proxyTx.logs[0].args.proxy)
  }

  return proxies
}

class Proxy {
  constructor (owner, proxies, scriptAddress) {
    this.owner = owner
    this.proxies = proxies
    this.scriptAddress = scriptAddress
  }

  getFrom(params) {
    if (params.length == 0) return this.owner
    let lastParam = params[params.length - 1]
    if (lastParam.from) {
      return lastParam.from
    }

    return this.owner
  }

  getOptionalParams(params) {
    if (params.length == 0) return {}

    return params[params.length - 1]
  }

  getProxyAddressFromUser(user) {
    return this.proxies[user] ? this.proxies[user].address : user
  }

  getProxyFromParams(params) {
    const user = this.getFrom(params)
    return this.proxies[user]
  }

  getSlicedParams(params) {
    if (params.length == 0) return params
    let lastParam = params[params.length - 1]
    if (lastParam.from || lastParam.value) {
      return params.slice(0, -1)
    }

    return params
  }

  async forwardFunction(params, signature) {
    const optionalParams = this.getOptionalParams(params)
    const proxy = this.getProxyFromParams(params)
    const calldata = th.getTransactionData(signature, this.getSlicedParams(params))
    // console.log('proxy: ', proxy.address)
    // console.log(this.scriptAddress, calldata, optionalParams)
    return proxy.executeTarget(this.scriptAddress, calldata, optionalParams)
  }
}

class TransparentProxy extends Proxy {
  constructor(owner, proxies, scriptAddress, contract) {
    super(owner, proxies, scriptAddress)
    this.contract = contract
  }

  async proxyFunctionWithUser(functionName, user) {
    return this.contract[functionName](this.getProxyAddressFromUser(user))
  }

  async proxyFunction(functionName, params) {
    // console.log('contract: ', this.contract.address)
    // console.log('functionName: ', functionName)
    // console.log('params: ', params)
    return this.contract[functionName](...params)
  }
}

class BorrowerOperationsProxy extends TransparentProxy {
  constructor(owner, proxies, borrowerOperationsScriptAddress, borrowerOperations) {
    super(owner, proxies, borrowerOperationsScriptAddress, borrowerOperations)
  }

  async openTrove(...params) {
    return this.forwardFunction(params, 'openTrove(uint256,uint256,address,address)')
  }

  async addColl(...params) {
    return this.forwardFunction(params, 'addColl(address,address)')
  }

  async withdrawColl(...params) {
    return this.forwardFunction(params, 'withdrawColl(uint256,address,address)')
  }

  async withdrawLUSD(...params) {
    return this.forwardFunction(params, 'withdrawLUSD(uint256,uint256,address,address)')
  }

  async repayLUSD(...params) {
    return this.forwardFunction(params, 'repayLUSD(uint256,address,address)')
  }

  async closeTrove(...params) {
    return this.forwardFunction(params, 'closeTrove()')
  }

  async adjustTrove(...params) {
    return this.forwardFunction(params, 'adjustTrove(uint256,uint256,uint256,bool,address,address)')
  }

  async claimRedeemedCollateral(...params) {
    return this.forwardFunction(params, 'claimRedeemedCollateral(address)')
  }

  async getNewTCRFromTroveChange(...params) {
    return this.proxyFunction('getNewTCRFromTroveChange', params)
  }

  async getNewICRFromTroveChange(...params) {
    return this.proxyFunction('getNewICRFromTroveChange', params)
  }

  async getCompositeDebt(...params) {
    return this.proxyFunction('getCompositeDebt', params)
  }
}

class TroveManagerProxy extends TransparentProxy {
  constructor(owner, proxies, troveManagerScriptAddress, troveManager) {
    super(owner, proxies, troveManagerScriptAddress, troveManager)
  }

  async Troves(user) {
    return this.proxyFunctionWithUser('Troves', user)
  }

  async getTroveStatus(user) {
    return this.proxyFunctionWithUser('getTroveStatus', user)
  }

  async getTroveDebt(user) {
    return this.proxyFunctionWithUser('getTroveDebt', user)
  }

  async totalStakes() {
    return this.proxyFunction('totalStakes', [])
  }

  async liquidate(user) {
    return this.proxyFunctionWithUser('liquidate', user)
  }

  async getTCR(...params) {
    return this.proxyFunction('getTCR', params)
  }

  async getCurrentICR(user, price) {
    return this.contract.getCurrentICR(this.getProxyAddressFromUser(user), price)
  }

  async checkRecoveryMode(...params) {
    return this.proxyFunction('checkRecoveryMode', params)
  }

  async getTroveOwnersCount() {
    return this.proxyFunction('getTroveOwnersCount', [])
  }

  async baseRate() {
    return this.proxyFunction('baseRate', [])
  }

  async L_ETH() {
    return this.proxyFunction('L_ETH', [])
  }

  async L_LUSDDebt() {
    return this.proxyFunction('L_LUSDDebt', [])
  }

  async rewardSnapshots(user) {
    return this.proxyFunctionWithUser('rewardSnapshots', user)
  }

  async lastFeeOperationTime() {
    return this.proxyFunction('lastFeeOperationTime', [])
  }

  async redeemCollateral(...params) {
    return this.forwardFunction(params, 'redeemCollateral(uint256,address,address,address,uint256,uint256,uint256)')
  }

  async getActualDebtFromComposite(...params) {
    return this.proxyFunction('getActualDebtFromComposite', params)
  }

  async getBorrowingRate() {
    return this.proxyFunction('getBorrowingRate', [])
  }
}

class SortedTrovesProxy extends TransparentProxy {
  constructor(owner, proxies, sortedTroves) {
    super(owner, proxies, null, sortedTroves)
  }

  async contains(user) {
    return this.proxyFunctionWithUser('contains', user)
  }

  async isEmpty(user) {
    return this.proxyFunctionWithUser('isEmpty', user)
  }
}

class TokenProxy extends TransparentProxy {
  constructor(owner, proxies, tokenScriptAddress, token) {
    super(owner, proxies, tokenScriptAddress, token)
  }

  async transfer(...params) {
    // switch destination to proxy if any
    params[0] = this.getProxyAddressFromUser(params[0])
    return this.forwardFunction(params, 'transfer(address,uint256)')
  }

  async totalSupply(...params) {
    return this.proxyFunction('totalSupply', params)
  }

  async balanceOf(user) {
    return this.proxyFunctionWithUser('balanceOf', user)
  }
}

module.exports = {
  buildUserProxies,
  BorrowerOperationsProxy,
  TroveManagerProxy,
  SortedTrovesProxy,
  TokenProxy
}
