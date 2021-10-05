const deploymentHelper = require("./../../utils/deploymentHelpers.js")
const testHelpers = require("./../../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const LUSDToken = artifacts.require("LUSDToken")
const NonPayable = artifacts.require('NonPayable.sol')
const BAMM = artifacts.require("BAMM.sol")
const BLens = artifacts.require("BLens.sol")
const ChainlinkTestnet = artifacts.require("ChainlinkTestnet.sol")

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

contract('BAMM', async accounts => {
  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dennis, erin, flyn,
    A, B, C, D, E, F,
    u1, u2, u3, u4, u5,
    v1, v2, v3, v4, v5,
    frontEnd_1, frontEnd_2, frontEnd_3,
    bammOwner
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let bamm
  let lens
  let chainlink
  let defaultPool
  let borrowerOperations
  let lqtyToken
  let communityIssuance

  let gasPriceInWei

  const feePool = "0x1000000000000000000000000000000000000001"

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  //const assertRevert = th.assertRevert

  describe("BAMM", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.lusdToken = await LUSDToken.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)

      priceFeed = contracts.priceFeedTestnet
      lusdToken = contracts.lusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers

      lqtyToken = LQTYContracts.lqtyToken
      communityIssuance = LQTYContracts.communityIssuance

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // Register 3 front ends
      //await th.registerFrontEnds(frontEnds, stabilityPool)

      // deploy BAMM
      chainlink = await ChainlinkTestnet.new(priceFeed.address)

      const kickbackRate_F1 = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      await stabilityPool.registerFrontEnd(kickbackRate_F1, { from: frontEnd_1 })

      bamm = await BAMM.new(chainlink.address, stabilityPool.address, lusdToken.address, lqtyToken.address, 400, feePool, frontEnd_1, {from: bammOwner})
      lens = await BLens.new()
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): increases the Stability Pool LUSD balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await bamm.deposit(toBN(200), { from: alice })

      // check LUSD balances after
      const stabilityPool_LUSD_After = await stabilityPool.getTotalLUSDDeposits()
      assert.equal(stabilityPool_LUSD_After, 200)
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): two users deposit, check their share", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })      

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await lusdToken.approve(bamm.address, toBN(200), { from: whale })      
      await bamm.deposit(toBN(200), { from: alice })
      await bamm.deposit(toBN(200), { from: whale })      

      // check LUSD balances after1
      const whaleShare = await bamm.stake(whale)
      const aliceShare = await bamm.stake(alice)

      assert.equal(whaleShare.toString(), aliceShare.toString())
    })

    // --- provideToSP() ---
    // increases recorded LUSD at Stability Pool
    it("deposit(): two users deposit, one withdraw. check their share", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraLUSDAmount: toBN(200), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })      

      // --- TEST ---
      await lusdToken.approve(bamm.address, toBN(200), { from: alice })
      await lusdToken.approve(bamm.address, toBN(100), { from: whale })      
      await bamm.deposit(toBN(200), { from: alice })
      await bamm.deposit(toBN(100), { from: whale })      

      // check LUSD balances after1
      const whaleShare = await bamm.stake(whale)
      const aliceShare = await bamm.stake(alice)

      assert.equal(whaleShare.mul(toBN(2)).toString(), aliceShare.toString())

      const whaleBalanceBefore = await lusdToken.balanceOf(whale)
      const shareToWithdraw = whaleShare.div(toBN(2));
      await bamm.withdraw(shareToWithdraw, { from: whale });

      const newWhaleShare = await bamm.stake(whale)
      assert.equal(newWhaleShare.mul(toBN(2)).toString(), whaleShare.toString())

      const whaleBalanceAfter = await lusdToken.balanceOf(whale)
      assert.equal(whaleBalanceAfter.sub(whaleBalanceBefore).toString(), 50)      
    })

    it('rebalance scenario', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      bamm.deposit(whaleLUSD, { from: whale } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })

      // Alice makes Trove and withdraws 100 LUSD
      await openTrove({ extraLUSDAmount: toBN(dec(100, 18)), ICR: toBN(dec(5, 18)), extraParams: { from: alice, value: dec(50, 'ether') } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));
      console.log("rebalance", (await bamm.fetchPrice()).toString())

      const SPLUSD_Before = await stabilityPool.getTotalLUSDDeposits()

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // Confirm SP has decreased
      const SPLUSD_After = await stabilityPool.getTotalLUSDDeposits()
      assert.isTrue(SPLUSD_After.lt(SPLUSD_Before))

      console.log((await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      console.log((await stabilityPool.getDepositorETHGain(bamm.address)).toString())
      const price = await priceFeed.fetchPrice.call()
      console.log(price.toString())

      const ammExpectedEth = await bamm.getSwapEthAmount.call(toBN(dec(1, 18)))

      console.log("expected eth amount", ammExpectedEth.ethAmount.toString())

      const rate = await bamm.getConversionRate(lusdToken.address, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", toBN(dec(1, 18)), 0)
      assert.equal(rate.toString(), ammExpectedEth.ethAmount.toString())

      await lusdToken.approve(bamm.address, toBN(dec(1, 18)), { from: alice })

      const dest = "0xe1A587Ac322da1611DF55b11A6bC8c6052D896cE" // dummy address
      //await bamm.swap(toBN(dec(1, 18)), dest, { from: alice })
      await bamm.trade(lusdToken.address, toBN(dec(1, 18)), "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", dest, rate, true, { from: alice });

      const swapBalance = await web3.eth.getBalance(dest)

      assert.equal(swapBalance, ammExpectedEth.ethAmount)
    })

    it("test basic LQTY allocation", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraLUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraLUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraLUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
      
      // D, E provide to bamm, F provide to SP
      await lusdToken.approve(bamm.address, dec(1000, 18), { from: D })
      await lusdToken.approve(bamm.address, dec(2000, 18), { from: E })
      await bamm.deposit(dec(1000, 18), { from: D })
      await bamm.deposit(dec(2000, 18), { from: E })
      await stabilityPool.provideToSP(dec(3000, 18), frontEnd_1, { from: F })

      // Get F1, F2, F3 LQTY balances before, and confirm they're zero
      const D_LQTYBalance_Before = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_Before = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_Before = await lqtyToken.balanceOf(F)

      assert.equal(D_LQTYBalance_Before, '0')
      assert.equal(E_LQTYBalance_Before, '0')
      assert.equal(F_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const expectdDLqtyDelta = await lens.getUnclaimedLqty.call(D, bamm.address, lqtyToken.address)
      const expectdELqtyDelta = await lens.getUnclaimedLqty.call(E, bamm.address, lqtyToken.address)

      // test get user info
      // send eth to get non zero eth
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: toBN(dec(3, 18))})
      const userInfo = await lens.getUserInfo.call(D, bamm.address, lqtyToken.address)
      //console.log({userInfo})
      assert.equal(userInfo.unclaimedLqty.toString(), expectdDLqtyDelta.toString())
      assert.equal(userInfo.bammUserBalance.toString(), (await bamm.balanceOf(D)).toString())
      assert.equal(userInfo.lusdUserBalance.toString(), dec(1000, 18).toString())
      assert.equal(userInfo.ethUserBalance.toString(), dec(1, 18).toString())
      assert.equal(userInfo.lusdTotal.toString(), dec(3000, 18).toString())
      assert.equal(userInfo.ethTotal.toString(), dec(3, 18).toString())      

      await stabilityPool.withdrawFromSP(0, { from: F })
      await bamm.withdraw(0, { from: D })
      await bamm.withdraw(0, { from: E })      

      // Get F1, F2, F3 LQTY balances after, and confirm they have increased
      const D_LQTYBalance_After = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_After = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_After = await lqtyToken.balanceOf(F)

      assert((await lqtyToken.balanceOf(frontEnd_1)).gt(toBN(0)))
      assert.equal(D_LQTYBalance_After.sub(D_LQTYBalance_Before).toString(), expectdDLqtyDelta.toString())
      assert.equal(E_LQTYBalance_After.sub(E_LQTYBalance_Before).toString(), expectdELqtyDelta.toString())      

      assert.equal(D_LQTYBalance_After.add(E_LQTYBalance_After).toString(), F_LQTYBalance_After.toString())
    })

    it("test share + LQTY fuzzy", async () => {
      const ammUsers = [u1, u2, u3, u4, u5]
      const userBalance = [0, 0, 0, 0, 0]
      const nonAmmUsers = [v1, v2, v3, v4, v5]

      let totalDeposits = 0

      // test almost equal
      assert(almostTheSame(web3.utils.toWei("9999"), web3.utils.toWei("9999")))
      assert(! almostTheSame(web3.utils.toWei("9989"), web3.utils.toWei("9999")))      

      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      for(let i = 0 ; i < ammUsers.length ; i++) {
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: ammUsers[i] } })
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: nonAmmUsers[i] } })

        await lusdToken.approve(bamm.address, dec(1000000, 18), { from: ammUsers[i] })

        const qty = toBN(20000)
        totalDeposits += Number(qty.toString())
        userBalance[i] += Number(qty.toString())
        await bamm.deposit(qty, { from: ammUsers[i] })
        await stabilityPool.provideToSP(qty, frontEnd_1, { from: nonAmmUsers[i] })
      }

      for(n = 0 ; n < 10 ; n++) {
        for(let i = 0 ; i < ammUsers.length ; i++) {
          await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR * (i + n + 1), web3.currentProvider)
          assert(almostTheSame((await lqtyToken.balanceOf(ammUsers[i])).toString(), (await lqtyToken.balanceOf(nonAmmUsers[i])).toString()))
          assert.equal((await lusdToken.balanceOf(ammUsers[i])).toString(), (await lusdToken.balanceOf(nonAmmUsers[i])).toString())

          const qty = (i+1) * 1000 + (n+1)*1000 // small number as 0 decimals
          if((n*7 + i*3) % 2 === 0) {
            const share = (await bamm.total()).mul(toBN(qty)).div(toBN(totalDeposits))
            console.log("withdraw", i, {qty}, {totalDeposits}, share.toString())
            await bamm.withdraw(share.toString(), { from: ammUsers[i] })
            await stabilityPool.withdrawFromSP(qty, { from: nonAmmUsers[i] })
            
            totalDeposits -= qty
            userBalance[i] -= qty
          }
          else {
            console.log("deposit", i)
            await bamm.deposit(qty, { from: ammUsers[i]} )
            await stabilityPool.provideToSP(qty, frontEnd_1, { from: nonAmmUsers[i] })

            totalDeposits += qty
            userBalance[i] += qty            
          }

          const totalSupply = await bamm.totalSupply()
          const userSupply = await bamm.balanceOf(ammUsers[i])
          // userSup / totalSupply = userBalance / totalDeposits
          assert.equal(userSupply.mul(toBN(totalDeposits)).toString(), toBN(userBalance[i]).mul(totalSupply).toString())

          await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR * (i + n + 1), web3.currentProvider)

          await bamm.withdraw(0, { from: ammUsers[i] })
          await stabilityPool.withdrawFromSP(0, { from: nonAmmUsers[i] })            

          await bamm.withdraw(0, { from: ammUsers[0] })
          await stabilityPool.withdrawFromSP(0, { from: nonAmmUsers[0] })                      

          assert.equal((await lusdToken.balanceOf(ammUsers[i])).toString(), (await lusdToken.balanceOf(nonAmmUsers[i])).toString())
          assert(almostTheSame((await lqtyToken.balanceOf(ammUsers[i])).toString(), (await lqtyToken.balanceOf(nonAmmUsers[i])).toString()))
          assert(almostTheSame((await lqtyToken.balanceOf(ammUsers[0])).toString(), (await lqtyToken.balanceOf(nonAmmUsers[0])).toString()))          
        }
      }

      console.log("get all lqty")
      for(let i = 0 ; i < ammUsers.length ; i++) {
        await bamm.withdraw(0, { from: ammUsers[i] })
        await stabilityPool.withdrawFromSP(0, { from: nonAmmUsers[i] })                    
      }

      for(let i = 0 ; i < ammUsers.length ; i++) {
        assert(almostTheSame((await lqtyToken.balanceOf(ammUsers[i])).toString(), (await lqtyToken.balanceOf(nonAmmUsers[i])).toString()))
      }      
    })
    
    it("test complex LQTY allocation", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      // A, B, C, open troves 
      await openTrove({ extraLUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraLUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraLUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })

      const A_LQTYBalance_Before = await lqtyToken.balanceOf(A)      
      const D_LQTYBalance_Before = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_Before = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_Before = await lqtyToken.balanceOf(F)

      assert.equal(A_LQTYBalance_Before, '0')      
      assert.equal(D_LQTYBalance_Before, '0')
      assert.equal(E_LQTYBalance_Before, '0')
      assert.equal(F_LQTYBalance_Before, '0')

      // D, E provide to bamm, F provide to SP
      await lusdToken.approve(bamm.address, dec(1000, 18), { from: D })
      await lusdToken.approve(bamm.address, dec(2000, 18), { from: E })
      await lusdToken.approve(bamm.address, dec(3000, 18), { from: F })      
      
      await bamm.deposit(dec(1000, 18), { from: D })
      await bamm.deposit(dec(2000, 18), { from: E })
      //await bamm.deposit(dec(3000, 18), { from: F }) 

      await bamm.withdraw(0, { from: D })
      console.log((await lqtyToken.balanceOf(D)).toString())

      console.log("share:", (await bamm.share.call()).toString())
      console.log("stake D:", (await bamm.stake(D)).toString())
      console.log("stake E:", (await bamm.stake(E)).toString())

      await stabilityPool.provideToSP(dec(1000, 18), frontEnd_1, { from: A })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await bamm.deposit(dec(3000, 18), { from: F })
      await stabilityPool.provideToSP(dec(3000, 18), frontEnd_1, { from: B })

      await stabilityPool.withdrawFromSP(0, { from: A })
      console.log("lqty A", (await lqtyToken.balanceOf(A)).toString())        

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)      

      console.log("share:", (await bamm.share()).toString())
      console.log("stake D:", (await bamm.stake(D)).toString())
      console.log("stake E:", (await bamm.stake(E)).toString())
      console.log("stake F:", (await bamm.stake(F)).toString())

      await stabilityPool.withdrawFromSP(0, { from: A })
      console.log("lqty A", (await lqtyToken.balanceOf(A)).toString())        

      await stabilityPool.withdrawFromSP(0, { from: A })
      await stabilityPool.withdrawFromSP(0, { from: B })      
      await bamm.withdraw(0, { from: D })
      await bamm.withdraw(0, { from: E })
      await bamm.withdraw(0, { from: F })            

      console.log("lqty D", (await lqtyToken.balanceOf(D)).toString())
      console.log("lqty E", (await lqtyToken.balanceOf(E)).toString())
      console.log("lqty F", (await lqtyToken.balanceOf(F)).toString())      
      
      console.log("share:", (await bamm.share()).toString())
      console.log("stake D:", (await bamm.stake(D)).toString())
      console.log("stake E:", (await bamm.stake(E)).toString())
      console.log("stake F:", (await bamm.stake(F)).toString())      

      // Get F1, F2, F3 LQTY balances after, and confirm they have increased
      const A_LQTYBalance_After = await lqtyToken.balanceOf(A)
      const B_LQTYBalance_After = await lqtyToken.balanceOf(B)      
      const D_LQTYBalance_After = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_After = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_After = await lqtyToken.balanceOf(F)

      assert.equal(D_LQTYBalance_After.toString(), A_LQTYBalance_After.toString())
      assert.equal(E_LQTYBalance_After.toString(), A_LQTYBalance_After.mul(toBN(2)).toString())
      assert.equal(F_LQTYBalance_After.toString(), B_LQTYBalance_After.toString()) 
    })

    it('test share with ether', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")
      //console.log(ethGains.toString(), (await stabilityPool.getDepositorETHGain(bamm.address)).toString())

      // send some ETH to simulate partial rebalance
      await web3.eth.sendTransaction({from: whale, to: bamm.address, value: toBN(dec(1, 18))})
      assert.equal(toBN(await web3.eth.getBalance(bamm.address)).toString(), toBN(dec(1, 18)).toString())

      const totalEth = ethGains.add(toBN(dec(1, 18)))
      const totalUsd = toBN(dec(6000, 18)).add(totalEth.mul(toBN(105)))

      await lusdToken.approve(bamm.address, totalUsd, { from: B })            
      await bamm.deposit(totalUsd, { from: B } )      

      assert.equal((await bamm.balanceOf(A)).toString(), (await bamm.balanceOf(B)).toString())

      const ethBalanceBefore = toBN(await web3.eth.getBalance(A))
      const LUSDBefore = await lusdToken.balanceOf(A)
      await bamm.withdraw(await bamm.balanceOf(A), {from: A, gasPrice: 0})
      const ethBalanceAfter = toBN(await web3.eth.getBalance(A))
      const LUSDAfter = await lusdToken.balanceOf(A)

      const withdrawUsdValue = LUSDAfter.sub(LUSDBefore).add((ethBalanceAfter.sub(ethBalanceBefore)).mul(toBN(105)))
      assert(in100WeiRadius(withdrawUsdValue.toString(), totalUsd.toString()))

      assert(in100WeiRadius("10283999999999999997375", "10283999999999999997322"))
      assert(! in100WeiRadius("10283999999999999996375", "10283999999999999997322"))      
    })

    it('price exceed max dicount and/or eth balance', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      // without fee
      await bamm.setParams(20, 0, {from: bammOwner})
      const price = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(price.ethAmount.toString(), dec(104, 18-2).toString())

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(priceWithFee.ethAmount.toString(), dec(10296, 18-4).toString())

      // without fee
      await bamm.setParams(20, 0, {from: bammOwner})
      const priceDepleted = await bamm.getSwapEthAmount(dec(1050000000000000, 18))
      assert.equal(priceDepleted.ethAmount.toString(), ethGains.toString())      

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceDepletedWithFee = await bamm.getSwapEthAmount(dec(1050000000000000, 18))
      assert.equal(priceDepletedWithFee.ethAmount.toString(), ethGains.mul(toBN(99)).div(toBN(100)))      
    })

    it('test getSwapEthAmount', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      const lusdQty = dec(105, 18)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 200)

      // without fee
      await bamm.setParams(200, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), expectedReturn.mul(toBN(100)).div(toBN(100 * 105)).toString())

      // with fee
      await bamm.setParams(200, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.ethAmount.toString(), expectedReturn.mul(toBN(99)).div(toBN(100 * 105)).toString())      
    })    

    it('test fetch price', async () => {
      await priceFeed.setPrice(dec(666, 18));
      assert.equal(await bamm.fetchPrice(), dec(666, 18))

      await chainlink.setTimestamp(888)
      assert.equal((await bamm.fetchPrice()).toString(), "0")      
    })

    it('test swap', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      // with fee
      await bamm.setParams(20, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(dec(105, 18))
      assert.equal(priceWithFee.ethAmount.toString(), dec(10296, 18-4).toString())
      assert.equal(priceWithFee.feeEthAmount.toString(), dec(10400 - 10296, 18-4).toString())      

      await lusdToken.approve(bamm.address, dec(105,18), {from: whale})
      const dest = "0xdEADBEEF00AA81bBCF694bC5c05A397F5E5658D5"

      await assertRevert(bamm.swap(dec(105,18), priceWithFee.ethAmount.add(toBN(1)), dest, {from: whale}), 'swap: low return')      
      await bamm.swap(dec(105,18), priceWithFee.ethAmount, dest, {from: whale}) // TODO - check once with higher value so it will revert

      // check lusd balance
      assert.equal(toBN(dec(6105, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())

      // check eth balance
      assert.equal(await web3.eth.getBalance(dest), priceWithFee.ethAmount)

      // check fees
      assert.equal(await web3.eth.getBalance(feePool), priceWithFee.feeEthAmount)
    })    

    it('test set params happy path', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: B } })
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1, } })
      await openTrove({ extraLUSDAmount: 0, ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_2, } })


      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(dec(105, 18));

      // Troves are closed
      await troveManager.liquidate(defaulter_1, { from: owner })
      await troveManager.liquidate(defaulter_2, { from: owner })

      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      const lusdQty = dec(105, 18)
      const expectedReturn200 = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 200)
      const expectedReturn190 = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 190)      

      assert(expectedReturn200.toString() !== expectedReturn190.toString())

      // without fee
      await bamm.setParams(200, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), expectedReturn200.mul(toBN(100)).div(toBN(100 * 105)).toString())

      // with fee
      await bamm.setParams(190, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.ethAmount.toString(), expectedReturn190.mul(toBN(99)).div(toBN(100 * 105)).toString())      
    })    
    
    it('test set params sad path', async () => {
      await assertRevert(bamm.setParams(210, 100, {from: bammOwner}), 'setParams: A too big')
      await assertRevert(bamm.setParams(10, 100, {from: bammOwner}), 'setParams: A too small')
      await assertRevert(bamm.setParams(10, 101, {from: bammOwner}), 'setParams: fee is too big')             
      await assertRevert(bamm.setParams(20, 100, {from: B}), 'Ownable: caller is not the owner')      
    })

    it.skip('transfer happy test', async () => { // transfer is not supported anymore
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: C } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(20, 18)), extraParams: { from: D } })            
      
      const whaleLUSD = await lusdToken.balanceOf(whale)
      await lusdToken.approve(bamm.address, whaleLUSD, { from: whale })
      await lusdToken.approve(bamm.address, toBN(dec(10000, 18)), { from: A })
      await bamm.deposit(toBN(dec(10000, 18)), { from: A } )
      await stabilityPool.provideToSP(toBN(dec(10000, 18)), frontEnd_1, {from: C})

      assert.equal(await bamm.balanceOf(A), dec(1, 18))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await stabilityPool.provideToSP(toBN(dec(5000, 18)), frontEnd_1, {from: D})      

      await bamm.transfer(B, dec(5, 17), {from: A})
      assert.equal(await bamm.balanceOf(A), dec(5, 17))
      assert.equal(await bamm.balanceOf(B), dec(5, 17))

      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: C })
      assert.equal(await lqtyToken.balanceOf(B), "0")
      await bamm.withdraw(0, {from: A})
      assert.equal((await lqtyToken.balanceOf(A)).toString(), (await lqtyToken.balanceOf(C)).toString())

      // reset A's usd balance
      await lusdToken.transfer(C, await lusdToken.balanceOf(A), {from: A})
      assert.equal(await lusdToken.balanceOf(A), "0")

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)      

      await bamm.withdraw(toBN(dec(5, 17)), {from: A}) // check balance
      await bamm.withdraw(toBN(dec(5, 17)), {from: B}) // check balance
      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: C })
      await stabilityPool.withdrawFromSP(toBN(dec(5000, 18)), { from: D })      

      assert.equal((await lqtyToken.balanceOf(B)).toString(), (await lqtyToken.balanceOf(D)).toString())      
      assert.equal((await lqtyToken.balanceOf(A)).toString(), (await lqtyToken.balanceOf(C)).toString())      

      assert.equal((await lusdToken.balanceOf(B)).toString(), dec(5000, 18))            
      assert.equal((await lusdToken.balanceOf(A)).toString(), dec(5000, 18))
    })


    // tests:
    // 1. complex lqty staking + share V
    // 2. share test with ether V
    // 3. basic share with liquidation (withdraw after liquidation) V
    // 4. price that exceeds max discount V
    // 5. price that exceeds balance V
    // 5.5 test fees and return V
    // 5.6 test swap  v
    // 6.1 test fetch price V
    // 6. set params V
    // 7. test with front end v
    // 8. formula V
    // 9. lp token - transfer sad test
    // 11. pickle V
    // 10. cleanups - compilation warnings. cropjoin - revoke changes and maybe make internal. V
    // 12 - linter. events
  })
})


function almostTheSame(n1, n2) {
  n1 = Number(web3.utils.fromWei(n1))
  n2 = Number(web3.utils.fromWei(n2))
  //console.log(n1,n2)

  if(n1 * 1000 > n2 * 1001) return false
  if(n2 * 1000 > n1 * 1001) return false  
  return true
}

function in100WeiRadius(n1, n2) {
  const x = toBN(n1)
  const y = toBN(n2)

  if(x.add(toBN(100)).lt(y)) return false
  if(y.add(toBN(100)).lt(x)) return false  
 
  return true
}

async function assertRevert(txPromise, message = undefined) {
  try {
    const tx = await txPromise
    // console.log("tx succeeded")
    assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
  } catch (err) {
    // console.log("tx failed")
    assert.include(err.message, "revert")
    
    if (message) {
       assert.include(err.message, message)
    }
  }
}