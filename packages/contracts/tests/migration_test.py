import pytest

from helpers import *
from migration_helpers import *

def _setup():
    contracts1 = deploy_contracts()
    contracts1.priceFeedTestnet.setPrice(ETHER_PRICE, { 'from': accounts[0] })

    flesh_out_system(accounts, contracts1)

    logGlobalState(contracts1, message="contracts1 initial")

    contracts2 = deploy_contracts()
    contracts2.priceFeedTestnet.setPrice(ETHER_PRICE, { 'from': accounts[0] })

    logGlobalState(contracts2, message="contracts2 initial")

    # fast forward the bootstrap phase to allow redemptions
    # doesn’t work with OpenEthereum
    # chain.sleep(14 * 24 * 60 * 60)
    # chain.mine()

    return [contracts1, contracts2]

def test_run_migration_desc(add_accounts):
    [contracts1, contracts2] = _setup()

    # migrate troves in ICR descending order
    run_migration_desc(accounts, contracts1, contracts2)

    logGlobalState(contracts1, message="contracts1 final")
    logGlobalState(contracts2, message="contracts2 final")

"""
# It fails at the first attempt, because first trove in the new system is < CCR
def test_run_migration_asc(add_accounts):
    [contracts1, contracts2] = _setup()

    # migrate troves in ICR ascending order
    run_migration_asc(accounts, contracts1, contracts2)

    logGlobalState(contracts1)
    logGlobalState(contracts2)
"""

def test_run_migration_rand(add_accounts):
    [contracts1, contracts2] = _setup()

    # migrate troves in ICR random order
    run_migration_rand(accounts, contracts1, contracts2)

    logGlobalState(contracts1)
    logGlobalState(contracts2)

"""
# It doesn’t make sense because redemption rate ends up growing too much.
def test_run_migration_redeem(add_accounts):
    [contracts1, contracts2] = _setup()

    # migrate troves in ICR random order
    run_migration_redeem(accounts, contracts1, contracts2)

    logGlobalState(contracts1)
    logGlobalState(contracts2)
"""

