import pytest

from brownie import *
from accounts import *

ZERO_ADDRESS = '0x' + '0'.zfill(40)
MAX_BYTES_32 = '0x' + 'F' * 64
MAX_FEE = Wei(1e18)

class Contracts: pass

def floatToWei(amount):
    return Wei(amount * 1e18)

def logGlobalState(contracts, message=""):
    print('\n ---- Global state ----')
    if message != "":
        print(message)
    print('Num troves      ', contracts.sortedTroves.getSize())
    activePoolColl = contracts.activePool.getETH()
    activePoolDebt = contracts.activePool.getLUSDDebt()
    defaultPoolColl = contracts.defaultPool.getETH()
    defaultPoolDebt = contracts.defaultPool.getLUSDDebt()
    print('Total Debt      ', (activePoolDebt + defaultPoolDebt).to("ether"))
    print('Total Coll      ', (activePoolColl + defaultPoolColl).to("ether"))
    print('SP LUSD         ', contracts.stabilityPool.getTotalLUSDDeposits().to("ether"))
    print('SP ETH          ', contracts.stabilityPool.getETH().to("ether"))
    price_ether_current = contracts.priceFeedTestnet.getPrice()
    print('ETH price       ', price_ether_current.to("ether"))
    print('TCR             ', contracts.troveManager.getTCR(price_ether_current).to("ether"))
    print('Rec. Mode       ', contracts.troveManager.checkRecoveryMode(price_ether_current))
    stakes_snapshot = contracts.troveManager.totalStakesSnapshot()
    coll_snapshot = contracts.troveManager.totalCollateralSnapshot()
    print('Stake snapshot  ', stakes_snapshot.to("ether"))
    print('Coll snapshot   ', coll_snapshot.to("ether"))
    if stakes_snapshot > 0:
        print('Snapshot ratio  ', coll_snapshot / stakes_snapshot)
    last_trove = contracts.sortedTroves.getLast()
    last_ICR = contracts.troveManager.getCurrentICR(last_trove, price_ether_current)
    #print('Last trove      ', last_trove)
    print('Last trove’s ICR', last_ICR.to("ether"))
    print(' ----------------------\n')

def setAddresses(contracts):
    contracts.sortedTroves.setParams(
        MAX_BYTES_32,
        contracts.troveManager.address,
        contracts.borrowerOperations.address,
        { 'from': accounts[0] }
    )

    contracts.troveManager.setAddresses(
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeedTestnet.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        contracts.lqtyToken.address,
        contracts.lqtyStaking.address,
        { 'from': accounts[0] }
    )

    contracts.borrowerOperations.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeedTestnet.address,
        contracts.sortedTroves.address,
        contracts.lusdToken.address,
        contracts.lqtyStaking.address,
        { 'from': accounts[0] }
    )

    contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        contracts.priceFeedTestnet.address,
        contracts.communityIssuance.address,
        { 'from': accounts[0] }
    )

    contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address,
        { 'from': accounts[0] }
    )

    contracts.defaultPool.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.hintHelpers.setAddresses(
        contracts.sortedTroves.address,
        contracts.troveManager.address,
        { 'from': accounts[0] }
    )

    # LQTY
    contracts.lqtyStaking.setAddresses(
        contracts.lqtyToken.address,
        contracts.lusdToken.address,
        contracts.troveManager.address,
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        { 'from': accounts[0] }
    )

    contracts.communityIssuance.setAddresses(
        contracts.lqtyToken.address,
        contracts.stabilityPool.address,
        { 'from': accounts[0] }
    )

def deploy_contracts():
    contracts = Contracts()

    contracts.priceFeedTestnet = PriceFeedTestnet.deploy({ 'from': accounts[0] })
    contracts.sortedTroves = SortedTroves.deploy({ 'from': accounts[0] })
    #contracts.troveManager = TroveManager.deploy({ 'from': accounts[0] })
    contracts.troveManager = TroveManagerNoBootstrap.deploy({ 'from': accounts[0] })
    contracts.activePool = ActivePool.deploy({ 'from': accounts[0] })
    contracts.stabilityPool = StabilityPool.deploy({ 'from': accounts[0] })
    contracts.gasPool = GasPool.deploy({ 'from': accounts[0] })
    contracts.defaultPool = DefaultPool.deploy({ 'from': accounts[0] })
    contracts.collSurplusPool = CollSurplusPool.deploy({ 'from': accounts[0] })
    contracts.borrowerOperations = BorrowerOperations.deploy({ 'from': accounts[0] })
    contracts.hintHelpers = HintHelpers.deploy({ 'from': accounts[0] })
    contracts.lusdToken = LUSDToken.deploy(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        { 'from': accounts[0] }
    )
    # LQTY
    contracts.lqtyStaking = LQTYStaking.deploy({ 'from': accounts[0] })
    contracts.communityIssuance = CommunityIssuance.deploy({ 'from': accounts[0] })
    contracts.lockupContractFactory = LockupContractFactory.deploy({ 'from': accounts[0] })
    contracts.lqtyToken = LQTYToken.deploy(
        contracts.communityIssuance.address,
        contracts.lqtyStaking.address,
        contracts.lockupContractFactory.address,
        accounts[1], # bountyAddress
        accounts[1],  # lpRewardsAddress
        { 'from': accounts[0] }
    )

    setAddresses(contracts)

    return contracts

@pytest.fixture
@pytest.mark.require_network("openethereum")
def add_accounts(scope="module"):
    import_accounts(accounts)
    """
    if network.show_active() != 'development':
        print("Importing accounts...")
        import_accounts(accounts)
    """
