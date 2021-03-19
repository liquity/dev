from brownie import Wei

ZERO_ADDRESS = '0x' + '0'.zfill(40)
MAX_BYTES_32 = '0x' + 'F' * 64

def floatToWei(amount):
    return Wei(amount * 1e18)

def logGlobalState(contracts, price_ether_current):
    print('\n ---- Global state ----')
    print('Num troves      ', contracts.sortedTroves.getSize())
    print('Total Debt      ', contracts.activePool.getLUSDDebt().to("ether"))
    print('Total Coll      ', contracts.activePool.getETH().to("ether"))
    print('ETH price       ', contracts.priceFeedTestnet.getPrice().to("ether"))
    print('TCR             ', contracts.troveManager.getTCR(floatToWei(price_ether_current)).to("ether"))
    print('Rec. Mode       ', contracts.troveManager.checkRecoveryMode(floatToWei(price_ether_current)))
    stakes_snapshot = contracts.troveManager.totalStakesSnapshot()
    coll_snapshot = contracts.troveManager.totalCollateralSnapshot()
    print('Stake snapshot  ', stakes_snapshot.to("ether"))
    print('Coll snapshot   ', coll_snapshot.to("ether"))
    if stakes_snapshot > 0:
        print('Snapshot ratio  ', coll_snapshot / stakes_snapshot)
    print(' ----------------------\n')
