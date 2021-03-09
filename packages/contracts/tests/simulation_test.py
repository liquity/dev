import pytest

from brownie import *
from helpers import *
from simulation_helpers import *

class Contracts: pass


def setAddresses(contracts):
    contracts.sortedTroves.setParams(
        MAX_BYTES_32,
        contracts.troveManager.address,
        contracts.borrowerOperations.address
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
        contracts.lqtyStaking.address
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
        contracts.lqtyStaking.address
    )

    contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        contracts.priceFeedTestnet.address,
        contracts.communityIssuance.address
    )

    contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address
    )

    contracts.defaultPool.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
    )

    contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
    )

    contracts.hintHelpers.setAddresses(
        contracts.sortedTroves.address,
        contracts.troveManager.address
    )

    # LQTY
    contracts.lqtyStaking.setAddresses(
        contracts.lqtyToken.address,
        contracts.lusdToken.address,
        contracts.troveManager.address, 
        contracts.borrowerOperations.address,
        contracts.activePool.address
    )

    contracts.communityIssuance.setAddresses(
        contracts.lqtyToken.address,
        contracts.stabilityPool.address
    )

@pytest.fixture
def contracts():
    contracts = Contracts()

    contracts.priceFeedTestnet = accounts[0].deploy(PriceFeedTestnet)
    contracts.sortedTroves = accounts[0].deploy(SortedTroves)
    contracts.troveManager = accounts[0].deploy(TroveManager)
    contracts.activePool = accounts[0].deploy(ActivePool)
    contracts.stabilityPool = accounts[0].deploy(StabilityPool)
    contracts.gasPool = accounts[0].deploy(GasPool)
    contracts.defaultPool = accounts[0].deploy(DefaultPool)
    contracts.collSurplusPool = accounts[0].deploy(CollSurplusPool)
    contracts.borrowerOperations = accounts[0].deploy(BorrowerOperations)
    contracts.hintHelpers = accounts[0].deploy(HintHelpers)
    contracts.lusdToken = accounts[0].deploy(
        LUSDToken,
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
    )
    # LQTY
    contracts.lqtyStaking = accounts[0].deploy(LQTYStaking)
    contracts.communityIssuance = accounts[0].deploy(CommunityIssuance)
    contracts.lockupContractFactory = accounts[0].deploy(LockupContractFactory)
    contracts.lqtyToken = accounts[0].deploy(
        LQTYToken,
        contracts.communityIssuance.address,
        contracts.lqtyStaking.address,
        contracts.lockupContractFactory.address,
        accounts[0], # bountyAddress
        accounts[0]  # lpRewardsAddress
    )

    setAddresses(contracts)

    return contracts

@pytest.fixture
def print_expectations():
    ether_price_one_year = price_ether_initial * (1 + drift_ether)**8760
    print("Expected ether price at the end of the year: $", ether_price_one_year)

    print("\n Open troves")
    print("E(Q_t^e) = ", collateral_gamma_k * collateral_gamma_theta)
    print("SD(Q_t^e) = ", collateral_gamma_k**(0.5) * collateral_gamma_theta)
    print("E(CR^*(i)) = ", target_cr_a + target_cr_b * target_cr_chi_square_df * 100, "%")
    print("SD(CR^*(i)) = ", target_cr_b * (2*target_cr_chi_square_df)**(1/2) * 100, "%")
    print("E(tau) = ", rational_inattention_gamma_k * rational_inattention_gamma_theta * 100, "%")
    print("SD(tau) = ", rational_inattention_gamma_k**(0.5) * rational_inattention_gamma_theta * 100, "%")

def _test_test(contracts):
    print(len(accounts))
    contracts.borrowerOperations.openTrove(Wei(1e18), Wei(2000e18), ZERO_ADDRESS, ZERO_ADDRESS,
                                           { 'from': accounts[1], 'value': Wei("100 ether") })

    #assert False

"""# Simulation Program
**Sequence of events**

> In each period, the following events occur sequentially


* exogenous ether price input
* trove liquidation
* return of the previous period's stability pool determined (liquidation gain & airdropped LQTY gain)
* trove closure
* trove adjustment
* open troves
* issuance fee
* trove pool formed
* LUSD supply determined
* LUSD stability pool demand determined
* LUSD liquidity pool demand determined
* LUSD price determined
* redemption & redemption fee
* LQTY pool return determined
"""
def test_run_simulation(contracts):
    MIN_NET_DEBT = contracts.troveManager.MIN_NET_DEBT() / 1e18

    price = contracts.priceFeedTestnet.setPrice(floatToWei(price_ether[0]))
    # whale
    contracts.borrowerOperations.openTrove(MAX_FEE, Wei(10e24), ZERO_ADDRESS, ZERO_ADDRESS,
                                           { 'from': accounts[0], 'value': Wei("30000 ether") })
    contracts.stabilityPool.provideToSP(floatToWei(stability_initial), ZERO_ADDRESS, { 'from': accounts[0] })

    active_accounts = []
    inactive_accounts = [*range(1, len(accounts))]

    price_LUSD = 1

    data = {"airdrop_gain": [0] * n_sim, "liquidation_gain": [0] * n_sim}
    total_lusd_redempted = 0
    total_coll_added = 0
    total_coll_liquidated = 0

    logGlobalState(contracts)
    #Simulation Process
    for index in range(1, n_sim):
        print('\n  --> Iteration', index)
        print('  -------------------\n')
        #exogenous ether price input
        price_ether_current = price_ether[index]
        price = contracts.priceFeedTestnet.setPrice(floatToWei(price_ether_current))
        #price_LQTY_previous = data.loc[index-1,'price_LQTY']

        #trove liquidation & return of stability pool
        result_liquidation = liquidate_troves(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_LUSD, data, index)
        total_coll_liquidated = total_coll_liquidated + result_liquidation[0]
        return_stability = result_liquidation[1]

        #close troves
        result_close = close_troves(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_LUSD, index)

        #adjust troves
        coll_added_adjust = adjust_troves(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, index)

        #open troves
        coll_added_open = open_troves(accounts, contracts, active_accounts, inactive_accounts, price_ether_current, price_LUSD, index)
        total_coll_added = total_coll_added + coll_added_adjust + coll_added_open
        #active_accounts.sort(key=lambda a : a.get('CR_initial'))

        #Stability Pool
        stability_update(accounts, contracts, return_stability, index)

        #Calculating Price, Liquidity Pool, and Redemption
        [price_LUSD, redemption_pool] = price_stabilizer(accounts, contracts, active_accounts, price_LUSD, index)
        total_lusd_redempted = total_lusd_redempted + redemption_pool
        print('LUSD price', price_LUSD)

        """
        #LQTY Market
        result_LQTY = LQTY_market(index, data)
        price_LQTY_current = result_LQTY[0]
        annualized_earning = result_LQTY[1]
        MC_LQTY_current = result_LQTY[2]
        """

        logGlobalState(contracts)
        print('Total redempted ', total_lusd_redempted)
        print('Total ETH added ', total_coll_added)
        print('Total ETH liquid', total_coll_liquidated)
        print(f'Ratio ETH liquid {100 * total_coll_liquidated / total_coll_added}%')
        print(' ----------------------\n')

        assert price_LUSD > 0
