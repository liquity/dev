const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const { keccak256 } = require('@ethersproject/keccak256');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toUtf8Bytes } = require('@ethersproject/strings');
const { pack } = require('@ethersproject/solidity');
const { hexlify } = require("@ethersproject/bytes");
const { ecsign } = require('ethereumjs-util');

const toBN = testHelpers.TestHelper.toBN
const assertRevert = testHelpers.TestHelper.assertRevert
const dec = testHelpers.TestHelper.dec
const ZERO_ADDRESS = testHelpers.TestHelper.ZERO_ADDRESS

const sign = (digest, privateKey) => {
  return ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKey.slice(2), 'hex'))
}

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

// Gets the EIP712 domain separator
const getDomainSeparator = (name, contractAddress, chainId, version)  => {
  return keccak256(defaultAbiCoder.encode(['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'], 
  [ 
    keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
    keccak256(toUtf8Bytes(name)), 
    keccak256(toUtf8Bytes(version)),
    parseInt(chainId), contractAddress.toLowerCase()
  ]))
}

// Returns the EIP712 hash which should be signed by the user
// in order to make a call to `permit`
const getPermitDigest = ( name, address, chainId, version,
                          owner, spender, value , 
                          nonce, deadline ) => {

  const DOMAIN_SEPARATOR = getDomainSeparator(name, address, chainId, version)
  return keccak256(pack(['bytes1', 'bytes1', 'bytes32', 'bytes32'],
    ['0x19', '0x01', DOMAIN_SEPARATOR, 
      keccak256(defaultAbiCoder.encode(
        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline])),
    ]))
}

contract('CLVToken', async accounts => {
  const [owner, alice, bob, carol, dennis] = accounts;

  // the second account our buidlerenv creates (for Alice)
  // from https://github.com/liquity/dev/blob/main/packages/contracts/buidlerAccountsList2k.js#L3
  const alicePrivateKey = '0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9'

  let chainId
  let clvTokenTester
  let stabilityPool
  let cdpManager
  let borrowerOperations

  let tokenName
  let tokenVersion

  describe('Basic token functions', async () => {
    beforeEach(async () => {
      chainId = await web3.eth.getChainId()
    
      const contracts = await deploymentHelper.deployTesterContractsBuidler()
 
      clvTokenTester = contracts.clvToken
      stabilityPool = contracts.stabilityPool
      cdpManager = contracts.stabilityPool
      borrowerOperations = contracts.borrowerOperations

      tokenVersion = await clvTokenTester.version()
      tokenName = await clvTokenTester.name()
    
      const LQTYContracts = await deploymentHelper.deployLQTYContracts()
  
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // mint some tokens
      await clvTokenTester.unprotectedMint(alice, 150)
      await clvTokenTester.unprotectedMint(bob, 100)
      await clvTokenTester.unprotectedMint(carol, 50)
    })

    it('balanceOf(): gets the balance of the account', async () => {
      const aliceBalance = (await clvTokenTester.balanceOf(alice)).toNumber()
      const bobBalance = (await clvTokenTester.balanceOf(bob)).toNumber()
      const carolBalance = (await clvTokenTester.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('totalSupply(): gets the total supply', async () => {
      const total = (await clvTokenTester.totalSupply()).toString()
      assert.equal(total, '300') // 300
    })

    it("name(): returns the token's name", async () => {
      const name = await clvTokenTester.name()
      assert.equal(name, "LUSD Stablecoin")
    })

    it("symbol(): returns the token's symbol", async () => {
      const symbol = await clvTokenTester.symbol()
      assert.equal(symbol, "LUSD")
    })

    it("version(): returns the token contract's version", async () => {
      const version = await clvTokenTester.version()
      assert.equal(version, "1")
    })

    it("decimal(): returns the number of decimal digits used", async () => {
      const decimals = await clvTokenTester.decimals()
      assert.equal(decimals, "18")
    })

    it("allowance(): returns an account's spending allowance for another account's balance", async () => {
      await clvTokenTester.approve(alice, 100, {from: bob})

      const allowance_A = await clvTokenTester.allowance(bob, alice)
      const allowance_D = await clvTokenTester.allowance(bob, dennis)

      assert.equal(allowance_A, 100)
      assert.equal(allowance_D, '0')
    })

    it("approve(): approves an account to spend the specified amount", async () => {
      const allowance_A_before = await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_before, '0')

      await clvTokenTester.approve(alice, 100, {from: bob})

      const allowance_A_after = await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_after, 100)

      // Bob attempts to approve more than his balance - check it reverts
      const txPromise = clvTokenTester.approve(carol, 100, {from: bob})
      assertRevert(txPromise)
    })

    it("approve(): reverts when spender param is address(0)", async () => {
      const txPromise = clvTokenTester.approve(ZERO_ADDRESS, 100, {from: bob})
      assertRevert(txPromise)
    })

    it("approve(): reverts when owner param is address(0)", async () => {
      const txPromise = clvTokenTester.callInternalApprove(ZERO_ADDRESS, alice, dec(1000, 18), {from: bob})
      assertRevert(txPromise)
    })

    it("transferFrom(): successfully transfers from an account which is it approved to transfer from", async () => {
      const allowance_A_0 = await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_0, '0')

      await clvTokenTester.approve(alice, 50, {from: bob})

      // Check A's allowance of Bob's funds has increased
      const allowance_A_1= await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_1, 50)


      assert.equal(await clvTokenTester.balanceOf(carol), 50)

      // Alice transfers from bob to Carol, using up her allowance
      await clvTokenTester.transferFrom(bob, carol, 50, {from: alice})
      assert.equal(await clvTokenTester.balanceOf(carol), 100)

       // Check A's allowance of Bob's funds has decreased
      const allowance_A_2= await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_2, '0')

      // Check bob's balance has decreased
      assert.equal(await clvTokenTester.balanceOf(bob), 50)

      // Alice tries to transfer more tokens from bob's account to carol than she's allowed
      const txPromise = clvTokenTester.transferFrom(bob, carol, 50, {from: alice})
      assertRevert(txPromise)
    })

    it("transfer(): increases the recipient's balance by the correct amount", async () => {
      assert.equal(await clvTokenTester.balanceOf(alice), 150)

      await clvTokenTester.transfer(alice, 37, {from: bob})

      assert.equal(await clvTokenTester.balanceOf(alice), 187)
    })

    it("transfer(): reverts if amount exceeds sender's balance", async () => {
      assert.equal(await clvTokenTester.balanceOf(bob), 100)

      const txPromise = clvTokenTester.transfer(alice, 101, {from: bob})
      assertRevert(txPromise)
    })

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(clvTokenTester.transfer(clvTokenTester.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(cdpManager.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(borrowerOperations.address, 1, { from: alice }))
    })

    it("increaseAllowance(): increases an account's allowance by the correct amount", async () => {
      const allowance_A_Before = await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_Before, '0')

      await clvTokenTester.increaseAllowance(alice, 100, {from: bob} )

      const allowance_A_After = await clvTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_After, 100)
    })

    it('mint(): issues correct amount of tokens to the given address', async () => {
      const alice_balanceBefore = await clvTokenTester.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenTester.unprotectedMint(alice, 100)

      const alice_BalanceAfter = await clvTokenTester.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 250)
    })

    it('burn(): burns correct amount of tokens from the given address', async () => {
      const alice_balanceBefore = await clvTokenTester.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenTester.unprotectedBurn(alice, 70)

      const alice_BalanceAfter = await clvTokenTester.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 80)
    })

    // TODO: Rewrite this test - it should check the actual clvTokenTester's balance.
    it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      const stabilityPool_BalanceBefore = await clvTokenTester.balanceOf(stabilityPool.address)
      const bob_BalanceBefore = await clvTokenTester.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 0)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenTester.unprotectedSendToPool(bob, stabilityPool.address, 75)

      const stabilityPool_BalanceAfter = await clvTokenTester.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvTokenTester.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 75)
      assert.equal(bob_BalanceAfter, 25)
    })

    it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      /// --- SETUP --- give pool 100 CLV
      await clvTokenTester.unprotectedMint(stabilityPool.address, 100)
      
      /// --- TEST --- 
      const stabilityPool_BalanceBefore = await clvTokenTester.balanceOf(stabilityPool.address)
      const  bob_BalanceBefore = await clvTokenTester.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 100)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenTester.unprotectedReturnFromPool(stabilityPool.address, bob, 75)

      const stabilityPool_BalanceAfter = await clvTokenTester.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvTokenTester.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 25)
      assert.equal(bob_BalanceAfter, 175)
    })

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(clvTokenTester.transfer(clvTokenTester.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(cdpManager.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(clvTokenTester.transfer(borrowerOperations.address, 1, { from: alice }))
    })
    
    // EIP2612 tests

    it('Initializes PERMIT_TYPEHASH correctly', async () => {
      assert.equal(await clvTokenTester.permitTypeHash(), PERMIT_TYPEHASH)
    })

    it('Initializes DOMAIN_SEPARATOR correctly', async () => {
      assert.equal(await clvTokenTester.domainSeparator(), 
      getDomainSeparator(tokenName, clvTokenTester.address, chainId, tokenVersion))
    })

    it('Initial nonce for a given address is 0', async function () {
      assert.equal(toBN(await clvTokenTester.nonces(alice)).toString(), '0');
    });
    
    it('permits and emits an Approval event (replay protected)', async () => {
      // Create the approval tx data
      const approve = {
        owner: alice,
        spender: bob,
        value: 1,
      }

      const deadline = 100000000000000
      const nonce = await clvTokenTester.nonces(approve.owner)
     
      // Get the EIP712 digest
      const digest = getPermitDigest(
        tokenName, clvTokenTester.address, 
        chainId, tokenVersion, 
        approve.owner, approve.spender,
        approve.value, nonce, deadline
      )
     
      const { v, r, s } = sign(digest, alicePrivateKey)
      
      // Approve it
      const receipt = await clvTokenTester.permit(
        approve.owner, approve.spender, approve.value, 
        deadline, v, hexlify(r), hexlify(s)
      )
      const event = receipt.logs[0]

      // Check that approval was successful
      assert.equal(event.event, 'Approval')
      assert.equal(await clvTokenTester.nonces(approve.owner), 1)
      assert.equal(await clvTokenTester.allowance(approve.owner, approve.spender), approve.value)
      
      // Check that we can not use re-use the same signature, since the user's nonce has been incremented (replay protection)
      assertRevert(clvTokenTester.permit(
        approve.owner, approve.spender, approve.value, 
        deadline, v, r, s), 'LUSD: Recovered address from the sig is not the owner')
     
      // Check that the zero address fails
      assertRevert(clvTokenTester.permit('0x0000000000000000000000000000000000000000', 
        approve.spender, approve.value, deadline, '0x99', r, s), 'LUSD: Recovered address from the sig is not the owner')
    })
  })
})



contract('Reset chain state', async accounts => {})
