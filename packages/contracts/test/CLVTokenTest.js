const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const { keccak256 } = require('@ethersproject/keccak256');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toUtf8Bytes } = require('@ethersproject/strings');
const { pack } = require('@ethersproject/solidity');
const { BigNumberish } = require('@ethersproject/bignumber');
const { hexlify } = require("@ethersproject/bytes");
const { ecsign } = require('ethereumjs-util');

const getDifference = testHelpers.getDifference
const moneyVals = testHelpers.MoneyValues

const toBN = testHelpers.TestHelper.toBN
const assertRevert = testHelpers.TestHelper.assertRevert
const ZERO_ADDRESS = testHelpers.TestHelper.ZERO_ADDRESS

const CLVTokenTester = artifacts.require('CLVTokenTester')
const CLVTokenCaller = artifacts.require('CLVTokenCaller')

contract('CLVToken', async accounts => {
  const [owner, alice, bob, carol] = accounts;

  // the second account our buidlerenv creates (for Alice)
  // from https://github.com/liquity/dev/blob/main/packages/contracts/buidlerAccountsList2k.js#L3
  const alicePrivateKey = '0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9'

  let chainId
  let clvToken
  let clvTokenCaller
  let tokenName
  let tokenVersion

  let cdpManager
  let stabilityPool
  let borrowerOperations

  describe('Basic token functions', async () => {
    beforeEach(async () => {
      chainId = await web3.eth.getChainId()
    
      const contracts = await deploymentHelper.deployLiquityCore()
 
      clvTokenCaller = await CLVTokenCaller.new()
      contracts.clvToken = await CLVTokenTester.new(
        clvTokenCaller.address,
        clvTokenCaller.address,
        clvTokenCaller.address
      )
      clvToken = contracts.clvToken
      await clvTokenCaller.setCLV(clvToken.address)
      tokenVersion = await clvToken.version()
      tokenName = await clvToken.name()
    
      cdpManager = clvTokenCaller
      stabilityPool = clvTokenCaller
      borrowerOperations = clvTokenCaller
      
      const LQTYContracts = await deploymentHelper.deployLQTYContracts()
  
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      // mint some tokens
      await clvTokenCaller.clvMint(alice, 150)
      await clvTokenCaller.clvMint(bob, 100)
      await clvTokenCaller.clvMint(carol, 50)
    })

    it('balanceOf: gets the balance of the account', async () => {
      const aliceBalance = (await clvToken.balanceOf(alice)).toNumber()
      const bobBalance = (await clvToken.balanceOf(bob)).toNumber()
      const carolBalance = (await clvToken.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('_totalSupply(): gets the total supply', async () => {
      const total = (await clvToken._totalSupply()).toString()
      assert.equal(total, '300') // 300
    })

    it('mint(): issues correct amount of tokens to the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenCaller.clvMint(alice, 100)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 250)
    })

    it('burn(): burns correct amount of tokens from the given address', async () => {
      const alice_balanceBefore = await clvToken.balanceOf(alice)
      assert.equal(alice_balanceBefore, 150)

      await clvTokenCaller.clvBurn(alice, 70)

      const alice_BalanceAfter = await clvToken.balanceOf(alice)
      assert.equal(alice_BalanceAfter, 80)
    })

    // TODO: Rewrite this test - it should check the actual clvTokenCaller's balance.
    it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 0)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenCaller.clvSendToPool(bob, stabilityPool.address, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 75)
      assert.equal(bob_BalanceAfter, 25)
    })

    it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
      /// --- SETUP --- give pool 100 CLV
      await clvTokenCaller.clvMint(stabilityPool.address, 100)
      
      /// --- TEST --- 
      const stabilityPool_BalanceBefore = await clvToken.balanceOf(stabilityPool.address)
      const  bob_BalanceBefore = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceBefore, 100)
      assert.equal(bob_BalanceBefore, 100)

      await clvTokenCaller.clvReturnFromPool(stabilityPool.address, bob, 75)

      const stabilityPool_BalanceAfter = await clvToken.balanceOf(stabilityPool.address)
      const bob_BalanceAfter = await clvToken.balanceOf(bob)
      assert.equal(stabilityPool_BalanceAfter, 25)
      assert.equal(bob_BalanceAfter, 175)
    })

    it('transfer(): all of these transfers should fail due to inappropriate recipient', async () => {
      await assertRevert(clvToken.transfer(clvToken.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(alice, 1, { from: alice }))
      await assertRevert(clvToken.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(clvToken.transfer(cdpManager.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(clvToken.transfer(borrowerOperations.address, 1, { from: alice }))
    })
    
    // EIP2612 tests

    it('initializes PERMIT_TYPEHASH correctly', async () => {
      assert.equal(await clvToken.permitTypeHash(), PERMIT_TYPEHASH)
    })

    it('initializes DOMAIN_SEPARATOR correctly', async () => {
      assert.equal(await clvToken.domainSeparator(), 
        getDomainSeparator(tokenName, clvToken.address, chainId, tokenVersion))
    })

    it('initial nonce is 0', async function () {
      assert.equal(toBN(await clvToken.nonces(alice)).toString(), '0');
    });
    
    it('permits and emits Approval (replay safe)', async () => {
      // Create the approval request
      const approve = {
        owner: alice,
        spender: bob,
        value: 1,
      }
      // deadline as much as you want in the future
      const deadline = 100000000000000
      // Get the user's nonce
      const nonce = await clvToken.nonces(approve.owner)
      // Get the EIP712 digest
      const digest = getPermitDigest(
        tokenName, clvToken.address, 
        chainId, tokenVersion, 
        approve.owner, approve.spender,
        approve.value, nonce, deadline
      )
      // NOTE: Using web3.eth.sign will hash the message internally again which
      // we do not want, so we're manually signing here
      const { v, r, s } = sign(digest, alicePrivateKey)
      
      // Approve it
      const receipt = await clvToken.permit(
        approve.owner, approve.spender, approve.value, 
        deadline, v, hexlify(r), hexlify(s)
      )
      const event = receipt.logs[0]
      // It worked!

      assert.equal(event.event, 'Approval')
      assert.equal(await clvToken.nonces(approve.owner), 1)
      assert.equal(await clvToken.allowance(approve.owner, approve.spender), approve.value)
      
      // Re-using the same sig doesn't work since the nonce has been incremented
      // on the contract level for replay-protection
      assertRevert(clvToken.permit(
        approve.owner, approve.spender, approve.value, 
        deadline, v, r, s), 'LUSD: BAD_SIG')
     
      // invalid ecrecover's return address(0x0), so we must also guarantee that
      // this case fails
      assertRevert(clvToken.permit('0x0000000000000000000000000000000000000000', 
        approve.spender, approve.value, deadline, '0x99', r, s), 'LUSD: BAD_SIG')
    })
  })
})

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

contract('Reset chain state', async accounts => {})
