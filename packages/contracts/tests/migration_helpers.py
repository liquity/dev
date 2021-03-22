from brownie import Wei

import random

from helpers import *

ETHER_PRICE = Wei(1000 * 1e18)
LUSD_GAS_COMPENSATION = Wei(50 * 1e18)

NONE = 0
CLOSED = 1
REDEEMED = 2
ALREADY_CLOSED = 3
CLOSE_FAILED = -1
OPEN_FAILED = -2

# Subtracts the borrowing fee
def get_lusd_amount_from_net_debt(contracts, net_debt):
    borrowing_rate = contracts.troveManager.getBorrowingRateWithDecay()
    return Wei(net_debt * Wei(1e18) / (Wei(1e18) + borrowing_rate))

# Subtracts the gas reserve and the borrowing fee
def get_lusd_amount_from_total_debt(contracts, total_debt):
    net_debt = total_debt - LUSD_GAS_COMPENSATION
    return get_lusd_amount_from_net_debt(contracts, net_debt)

def flesh_out_system(accounts, contracts):
    LUSD_GAS_COMPENSATION = contracts.troveManager.LUSD_GAS_COMPENSATION()

    MIN_NET_DEBT = contracts.troveManager.MIN_NET_DEBT()
    MIN_LUSD_AMOUNT = get_lusd_amount_from_net_debt(contracts, MIN_NET_DEBT) + Wei(1e18)

    # Account 0 will always be the last one, as one has to remain in the system
    collateral = Wei(MIN_NET_DEBT * 6 * 1e18 / ETHER_PRICE) # ICR: ~600% (missing gas reserve)
    contracts.borrowerOperations.openTrove(MAX_FEE, MIN_LUSD_AMOUNT, ZERO_ADDRESS, ZERO_ADDRESS,
                                           { 'from': accounts[0], 'value': collateral })

    # send 1 lqty token to account 1 (deployer cannot stake during 1st year),
    #contracts.lqtyToken.transfer(accounts[1], 1, { 'from': accounts[0] })
    # account 1 stakes to earn borrowing fees
    contracts.lqtyStaking.stake(1, { 'from': accounts[1] })

    # open trove in ICR descending order
    ICR = 500
    for i in range(1, 1000):
        lusd_amount = MIN_LUSD_AMOUNT + floatToWei(1000000 * random.random()) # lusd ranging from min to 1M
        borrowing_fee = contracts.troveManager.getBorrowingFeeWithDecay(lusd_amount)
        if ICR < 120:
            ICR = ICR - 0.01
        else:
            ICR = ICR - 0.76 * random.random() # last trove ICR should be at ~ 500 - 999*0.76*0.5 = 120.38
        coll = Wei((lusd_amount + borrowing_fee + LUSD_GAS_COMPENSATION) * floatToWei(ICR / 100) / ETHER_PRICE)
        try:
            contracts.borrowerOperations.openTrove(MAX_FEE, lusd_amount, accounts[i-1], ZERO_ADDRESS,
                                                   { 'from': accounts[i], 'value': coll })
        except:
            print("\n Opening trove failed! \n")
            print(f"Borrower Operations: {contracts.borrowerOperations.address}")
            print(f"i: {i}")
            print(f"account: {accounts[i]}")
            print(f"ICR: {ICR}")
            print(f"coll: {coll}")
            print(f"debt: {lusd_amount}")
            exit(1)

    # claim LUSD gain from LQTY Staking
    contracts.lqtyStaking.unstake(0, { 'from': accounts[1] })

def get_lusd_to_repay(accounts, contracts, account, debt):
    if account == accounts[1]:
        return
    lusd_balance = contracts.lusdToken.balanceOf(account)
    pending = Wei(0)

    if debt > lusd_balance:
        pending = debt - lusd_balance
        sender_balance = contracts.lusdToken.balanceOf(accounts[1])
        if sender_balance < pending:
            print(f"\n ***Error: not enough LUSD to repay! {debt / 1e18} LUSD for {account}, pending {pending / 1e18}, sender balance {sender_balance / 1e18}")
            return

        contracts.lusdToken.transfer(account, pending, { 'from': accounts[1] })

    return lusd_balance + pending

def migrate_trove(accounts, contracts1, contracts2, i, upper_hint=None, lower_hint=None):
    result = NONE
    # [debt, coll] = contracts1.troveManager.getEntireDebtAndColl(accounts[i])
    trove = contracts1.troveManager.getEntireDebtAndColl(accounts[i])
    debt = trove[0]
    coll = trove[1]
    get_lusd_to_repay(accounts, contracts1, accounts[i], debt - LUSD_GAS_COMPENSATION)

    total_coll = contracts1.troveManager.getEntireSystemColl() - coll
    total_debt = contracts1.troveManager.getEntireSystemDebt() - debt
    # Trove may have been closed by a redemption
    trove_status = contracts1.troveManager.getTroveStatus(accounts[i])
    if trove_status != Wei(1):
        # TODO: claim remaining collateral and then open
        return ALREADY_CLOSED
    TCR = contracts1.hintHelpers.computeCR(total_coll, total_debt, ETHER_PRICE)
    if TCR >= Wei(150 * 1e16):
        # close trove in old system
        try:
            contracts1.borrowerOperations.closeTrove({ 'from': accounts[i] })
            result = CLOSED
        except:
            print("\n Closing trove failed! \n")
            print(f"Borrower Operations: {contracts1.borrowerOperations.address}")
            print(f"i: {i}")
            print(f"account: {accounts[i]}")
            print(f"coll: {coll}")
            print(f"debt: {debt}")
            return CLOSE_FAILED
    else:
        print(f"After account {i}, resulting TCR: {TCR / 1e18}, redeeming")
        if redeem_trove(accounts, contracts1, i):
            # TODO: try to claim remaining collateral (if any) and then open
            return REDEEMED

    # open trove in new system
    try:
        if not upper_hint or not lower_hint:
            NICR = contracts2.hintHelpers.computeNominalCR(coll, debt)
            [upper_hint, lower_hint] = contracts2.sortedTroves.findInsertPosition(NICR, ZERO_ADDRESS, ZERO_ADDRESS)

        lusd_amount = get_lusd_amount_from_total_debt(contracts2, debt)

        #coll = Wei((lusd_amount + borrowing_fee + LUSD_GAS_COMPENSATION) * floatToWei(ICR / 100) / ETHER_PRICE)
        contracts2.borrowerOperations.openTrove(MAX_FEE, lusd_amount, upper_hint, lower_hint,
                                                { 'from': accounts[i], 'value': coll })
    except:
        print("\n Opening trove in the new system failed! \n")
        print(f"Borrower Operations: {contracts2.borrowerOperations.address}")
        print(f"i: {i}")
        print(f"account: {accounts[i]}")
        print(f"coll: {coll}")
        print(f"lusd: {lusd_amount}")
        print(f"ICR: {coll * ETHER_PRICE / debt / 1e18}")
        print(f"ETH bal : {accounts[i].balance()}")
        print(f"LUSD bal: {contracts2.lusdToken.balanceOf(accounts[i])}")
        print(f"upper hint: {upper_hint}")
        print(f"NICR: {contracts2.troveManager.getNominalICR(upper_hint)}")
        print(f"lower hint: {lower_hint}")
        print(f"NICR: {contracts2.troveManager.getNominalICR(lower_hint)}")
        last = contracts2.sortedTroves.getLast()
        print(f"last trove: {last}")
        print(f"NICR: {contracts2.troveManager.getNominalICR(last)}")
        return OPEN_FAILED

    return result

def redeem_trove(accounts, contracts, i):
    lusd_balance = contracts.lusdToken.balanceOf(accounts[i])
    [firstRedemptionHint, partialRedemptionHintNICR, truncatedLUSDamount] = contracts.hintHelpers.getRedemptionHints(lusd_balance, ETHER_PRICE, 70)
    if truncatedLUSDamount == Wei(0):
        return False
    approxHint = contracts.hintHelpers.getApproxHint(partialRedemptionHintNICR, 2000, 0)
    hints = contracts.sortedTroves.findInsertPosition(partialRedemptionHintNICR, approxHint[0], approxHint[0])
    try:
        contracts.troveManager.redeemCollateral(
            truncatedLUSDamount,
            firstRedemptionHint,
            hints[0],
            hints[1],
            partialRedemptionHintNICR,
            70,
            MAX_FEE,
            { 'from': accounts[i], 'gas_limit': 8000000, 'allow_revert': True }
        )
    except:
        print(f"\n   Redemption failed! ")
        print(f"Trove Manager: {contracts.troveManager.address}")
        print(f"LUSD Token:    {contracts.lusdToken.address}")
        print(f"i: {i}")
        print(f"account: {accounts[i]}")
        print(f"LUSD bal: {lusd_balance / 1e18}")
        print(f"truncated: {truncatedLUSDamount / 1e18}")
        print(f"Redemption rate: {contracts.troveManager.getRedemptionRateWithDecay() * 100 / 1e18} %")
        print(f"approx: {approxHint[0]}")
        print(f"diff: {approxHint[1]}")
        print(f"diff: {approxHint[1] / 1e18}")
        print(f"seed: {approxHint[2]}")
        print(f"amount: {truncatedLUSDamount}")
        print(f"first: {firstRedemptionHint}")
        print(f"hint: {hints[0]}")
        print(f"hint: {hints[1]}")
        print(f"nicr: {partialRedemptionHintNICR}")
        print(f"nicr: {partialRedemptionHintNICR / 1e18}")
        print(f"70")
        print(f"{MAX_FEE}")
        exit(1)

    return True

def run_migration_desc(accounts, contracts1, contracts2):
    # redemption break the previous order
    redemption_happened = False
    for i in range(1, 1000):
        if redemption_happened:
            upper_hint = None
            lower_hint = None
        else:
            upper_hint = contracts2.sortedTroves.getLast()
            lower_hint = ZERO_ADDRESS

        result = migrate_trove(accounts, contracts1, contracts2, i, upper_hint, lower_hint)
        if result == REDEEMED:
            redemption_happened = True
        if result < 0:
            break
    if redemption_happened:
        # TODO: make another pass to claim remaining collateral, close troves, and re-open
        pass

def run_migration_asc(accounts, contracts1, contracts2):
    for i in range(999, 0, -1):
        migrate_trove(accounts, contracts1, contracts2, i, ZERO_ADDRESS, contracts2.sortedTroves.getFirst())

def run_migration_rand(accounts, contracts1, contracts2):
    remaining = list(range(1, 1000))
    while(len(remaining) > 0):
        i = random.randrange(0, len(remaining))
        migrate_trove(accounts, contracts1, contracts2, remaining[i])
        remaining.pop(i)

def run_migration_redeem(accounts, contracts1, contracts2):
    for i in range(1, 1000):
        redeem_trove(accounts, contracts1, i)
