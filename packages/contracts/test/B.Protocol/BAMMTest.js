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
  let chainlink
  let defaultPool
  let borrowerOperations
  let lqtyToken
  let communityIssuance

  let gasPriceInWei

  const feePool = "0x1000000000000000000000000000000000000001"

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const assertRevert = th.assertRevert

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
      await th.registerFrontEnds(frontEnds, stabilityPool)

      // deploy BAMM
      chainlink = await ChainlinkTestnet.new(priceFeed.address)
      bamm = await BAMM.new(chainlink.address, stabilityPool.address, lusdToken.address, lqtyToken.address, 400, feePool)
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
      await stabilityPool.provideToSP(dec(3000, 18), "0x0000000000000000000000000000000000000000", { from: F })

      // Get F1, F2, F3 LQTY balances before, and confirm they're zero
      const D_LQTYBalance_Before = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_Before = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_Before = await lqtyToken.balanceOf(F)

      assert.equal(D_LQTYBalance_Before, '0')
      assert.equal(E_LQTYBalance_Before, '0')
      assert.equal(F_LQTYBalance_Before, '0')

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await stabilityPool.withdrawFromSP(0, { from: F })
      await bamm.withdraw(0, { from: D })
      await bamm.withdraw(0, { from: E })      

      // Get F1, F2, F3 LQTY balances after, and confirm they have increased
      const D_LQTYBalance_After = await lqtyToken.balanceOf(D)
      const E_LQTYBalance_After = await lqtyToken.balanceOf(E)
      const F_LQTYBalance_After = await lqtyToken.balanceOf(F)

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
        await stabilityPool.provideToSP(qty, "0x0000000000000000000000000000000000000000", { from: nonAmmUsers[i] })
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
            await stabilityPool.provideToSP(qty, "0x0000000000000000000000000000000000000000", { from: nonAmmUsers[i] })

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

      await stabilityPool.provideToSP(dec(1000, 18), "0x0000000000000000000000000000000000000000", { from: A })

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      await bamm.deposit(dec(3000, 18), { from: F })
      await stabilityPool.provideToSP(dec(3000, 18), "0x0000000000000000000000000000000000000000", { from: B })

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

    it.only('test share with ether', async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: dec(50, 'ether') } })
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      
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

    })    

    // tests:
    // 1. complex lqty staking + share V
    // 2. share test with ether V
    // 3. basic share with liquidation
    // 4. price that exceeds max discount
    // 5. price that exceeds balance
    // 6. set params
    // 7. test with front end
    // 8. formula V
    // 9. lp token
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

