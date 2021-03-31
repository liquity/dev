from brownie import Wei

ZERO_ADDRESS = '0x' + '0'.zfill(40)
MAX_BYTES_32 = '0x' + 'F' * 64

def floatToWei(amount):
    return Wei(amount * 1e18)

def logGlobalState(contracts):
    print('\n ---- Global state ----')
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
