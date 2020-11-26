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
  const [owner, alice, bob, carol] = accounts;

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

    it('balanceOf: gets the balance of the account', async () => {
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

    it('transfer(): all of these transfers should fail due to inappropriate recipient', async () => {
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
