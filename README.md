# Liquity System Summary

![Tests](https://github.com/liquity/dev/workflows/CI/badge.svg) [![Frontend status](https://img.shields.io/uptimerobot/status/m785036778-7edf816c69dafd2d19c45491?label=Frontend&logo=nginx&logoColor=white)](https://devui.liquity.org/internal) ![uptime](https://img.shields.io/uptimerobot/ratio/7/m785036778-7edf816c69dafd2d19c45491) [![Discord](https://img.shields.io/discord/700620821198143498?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/2up5U32) [![Docker Pulls](https://img.shields.io/docker/pulls/liquity/dev-frontend?label=dev-frontend%20pulls&logo=docker&logoColor=white)](https://hub.docker.com/r/liquity/dev-frontend)

- [Liquity Overview](#liquity-overview)
  - [Liquidation and the Stability Pool](#liquidation-and-the-stability-pool)
  - [Rewards From Liquidations](#rewards-from-liquidations)
  - [Recovery Mode](#recovery-mode)
  - [LUSD Token Redemption](#lusd-token-redemption)
  - [Project Structure](#project-structure)
    - [Directories](#directories)
    - [Branches](#branches)
  - [LQTY Token Architecture](#lqty-token-architecture)
    - [LQTY lockup contracts and token vesting](#lqty-lockup-contracts-and-token-vesting)
    - [Lockup Implementation and admin transfer restriction](#lockup-implementation-and-admin-transfer-restriction)
    - [Launch sequence and vesting process](#launch-sequence-and-vesting-process)
  - [Core System Architecture](#core-system-architecture)
    - [Core Smart Contracts](#core-smart-contracts)
    - [Data and Value Silo Contracts](#data-and-value-silo-contracts)
    - [Contract Interfaces](#contract-interfaces)
    - [PriceFeed and Oracle](#pricefeed-and-oracle)
    - [Keeping a sorted list of troves ordered by ICR](#keeping-a-sorted-list-of-troves-ordered-by-icr)
    - [Flow of Ether in Liquity](#flow-of-ether-in-liquity)
    - [Flow of ERC20 tokens in Liquity](#flow-of-erc20-tokens-in-liquity)
  - [Expected User Behaviors](#expected-user-behaviors)
  - [Contract Ownership and Function Permissions](#contract-ownership-and-function-permissions)
  - [Deployment to a Development Blockchain](#deployment-to-a-development-blockchain)
  - [Running Tests](#running-tests)
  - [System Quantities - Units and Representation](#system-quantities---units-and-representation)
    - [Integer representations of decimals](#integer-representations-of-decimals)
  - [Public Data](#public-data)
  - [Public User-Facing Functions](#public-user-facing-functions)
  - [Supplying Hints to Trove operations](#supplying-hints-to-trove-operations)
  - [Gas Compensation](#gas-compensation)
  - [The Stability Pool](#the-stability-pool)
  - [LQTY Issuance to Stability Depositors](#lqty-issuance-to-stability-depositors)
  - [Liquity System Fees](#liquity-system-fees)
  - [Redistributions and Corrected Stakes](#redistributions-and-corrected-stakes)
  - [Math Proofs](#math-proofs)
  - [Definitions](#definitions)
  - [Development](#development)
    - [Prerequisites](#prerequisites)
      - [Making node-gyp work](#making-node-gyp-work)
    - [Top-level scripts](#top-level-scripts)
      - [Run all tests](#run-all-tests)
      - [Deploy contracts to a testnet](#deploy-contracts-to-a-testnet)
      - [Start a local blockchain and deploy the contracts](#start-a-local-blockchain-and-deploy-the-contracts)
      - [Start dev-frontend in development mode](#start-dev-frontend-in-development-mode)
      - [Start dev-frontend in demo mode](#start-dev-frontend-in-demo-mode)
      - [Build dev-frontend for production](#build-dev-frontend-for-production)

## Liquity Overview

Liquity is a collateralized debt platform. Users can lock up Ether, and issue stablecoin tokens (LUSD) to their own Ethereum address, and subsequently transfer those tokens to any other Ethereum address. The individual collateralized debt positions are called troves.

The stablecoin tokens are economically geared towards maintaining value of 1 LUSD = \$1 USD, due to the following properties:

1. The system is designed to always be over-collateralized - the dollar value of the locked Ether exceeds the dollar value of the issued stablecoins

2. The stablecoins are fully redeemable - users can always swap $x worth of LUSD for $x worth of ETH (minus fees), directly with the system.

3. The system algorithmically controls the generation of LUSD through a variable debt issuance fee.

After opening a trove with some Ether, users may issue ("borrow") tokens such that the collateral ratio of their trove remains above 110%. A user with $1000 worth of ETH in a trove can issue up to $909.09 worth of trove.

The tokens are freely exchangeable - anyone with an Ethereum address can send or receive LUSD tokens, whether they have an open trove or not. The tokens are burned upon repayment of a trove's debt.

The Liquity system regularly updates the ETH:USD price via a decentralized data feed. When a trove falls below a minimum collateral ratio (MCR) of 110%, it is considered under-collateralized, and is vulnerable to liquidation.

## Liquidation and the Stability Pool

Liquity utilizes a two-step liquidation mechanism in the following order of priority: 

1. Offset under-collateralized troves against the Stability Pool containing LUSD tokens

2. Redistribute under-collateralized troves to other borrowers if the Stability Pool is emptied

Liquity primarily uses the LUSD tokens in its Stability Pool to absorb the under-collateralized debt, i.e. to repay the liquidated borrower's liability.

Any user may deposit LUSD tokens to the Stability Pool. This allows them to earn the collateral from the liquidated trove. When a liquidation occurs, the liquidated debt is cancelled with the same amount of LUSD in the Pool (which is burned as a result), and the liquidated Ether is proportionally distributed to depositors.

Stability Pool depositors can expect to earn net gains from liquidations, as in most cases, the value of the liquidated Ether will be greater than the value of the cancelled debt (since a liquidated trove will likely have an ICR just slightly below 110%).

If the liquidated debt is higher than the amount of LUSD in the Stability Pool, the system tries to cancel as much debt as possible with the tokens in the Stability Pool, and then redistributes the remaining liquidated collateral and debt across all active troves.

Anyone may call the public `liquidateTroves()` function, which will check for under-collateralized troves, and liquidate them.

## Gains From Liquidations

Stability Pool depositors gain Ether over time, as liquidated debt is cancelled with their deposit. When they withdraw all or part of their deposited tokens, or top up their deposit, they system sends them their accumulated ETH gains.

Similarly, a trove's accumulated gains from liquidations are automatically applied to the trove when the owner performs any operation - e.g. adding/withdrawing collateral, or issuing/repaying LUSD.

## LUSD Token Redemption

Any LUSD holder (whether or not they have an active trove) may redeem their LUSD directly with the system. Their LUSD is exchanged for ETH, at face value: redeeming x LUSD tokens returns \$x worth of ETH (minus a [redemption fee](#redemption-fee)).

When LUSD is redeemed for ETH, the system cancels the LUSD with debt from troves, and the ETH is drawn from their collateral.

In order to fulfill the redemption request, troves are redeemed from in ascending order of their collateral ratio.

Economically, this redemption mechanism creates a hard price floor for LUSD, ensuring that the market price stays at or near to \$1 USD.

## Recovery Mode

Recovery Mode kicks in when the total collateral ratio (TCR) of the system falls below 150%.

During Recovery Mode, liquidation conditions are relaxed, and the system blocks issuance of new LUSD, and withdrawal of collateral. Recovery Mode is structured to incentivize borrowers to behave in ways that promptly raise the TCR back above 150%.

Recovery Mode is designed to encourage collateral top-ups, and also itself acts as a self-negating deterrent: the possibility of it occurring actually guides the system away from ever reaching it.

## Project Structure

### Directories

**TODO: add full directory structure!**

- `packages/dev-frontend/` - Liquity Developer UI: a fully functional React app used for interfacing with the smart contracts during development
- `packages/frontend/` - The front-end React app for the user-facing web interface
- `packages/lib-base/` - todo
- `packages/lib-ethers/`- todo
- `packages/lib-react/` - todo
- `packages/lib-subgraph/` - todo
- `packages/contracts/` The backend development folder, contains the Buidler project, contracts and tests
- `packages/contracts/contracts/` -The core back end smart contracts written in Solidity
- `packages/contracts/test/` - JS test suite for the system. Tests run in Mocha/Chai
- `packages/contracts/gasTest/` - Non-assertive tests that return gas costs for Liquity operations under various scenarios
- `packages/contracts/migrations/` - contains Buidler script for deploying the smart contracts to the blockchain
- `packages/contracts/utils/` - external Buidler and node scripts - deployment helpers, gas calculators, etc
- `packages/contracts/mathProofs/` - core mathematical proofs of Liquity properties, and a derivation of the scalable Stability Pool staking formula

Backend development is done in the Buidler framework, and allows Liquity to be deployed on the Buidler EVM network for fast compilation and test execution.

### Branches

**TODO: check and update before audit**

As of 21/08/2020, the current working branch is `main`.  

`master` is somewhat out of date, as our CI pipeline automatically redeploys contracts to testnet from master branch, and we want users to have a chance to engage with the existing deployments.

A code freeze for the simulation project will be located on a branch named `simulation`.

Other branches contain functionality that has either been shelved (`size-range-lists`, `overstay`) or integrated into our core system (`security-tweaks`).

## LQTY Token Architecture

The Liquity system incorporates a secondary token, LQTY. This token entitles the holder to a share of the system revenue generated by redemption fees and  issuance fees.

To earn a share of system fees, the LQTY holder must stake their LQTY in a staking contract.

Liquity also issues LQTY to Stability Pool depositors, in a continous time-based manner.

The LQTY contracts consist of:

`LQTYStaking.sol` - the staking contract, containing stake and unstake functionality for LQTY holders. This contract receives ETH fees from redemptions, and LUSD fees from new debt issuance.

`CommunityIssuance.sol` - This contract handles the issuance of LQTY tokens to Stability Pool depositors as a function of time. It is controlled by the `PoolManager`. Upon system launch, the Liquity admin will transfer an initial supply of LQTY to it - the “community issuance” supply. The contract steadily issues these LQTY tokens to the Stability Pool depositors over time.

`GrowthToken.sol` - This is the LQTY ERC20 contract. It has a hard cap supply of 100 million, and during the first year, restricts transfers from the Liquity admin address, a regular Ethereum address controlled by the project company Liquity AG. **Note that the Liquity admin address has no extra privileges and does not retain any control over the Liquity protocol once deployed.**

### LQTY Lockup contracts and token vesting

Some LQTY is reserved for team members and partners, and is locked up for one year upon system launch. Additionally, some team members receive LQTY vested on a monthly basis, which during the first year, is transferred directly to their lockup contract.

In the first year after launch:

- All team members and partners are unable to access their locked up LQTY tokens

- The Liquity admin address may transfer tokens **only to verified one-year lockup contracts**

Thus only LQTY made freely available in this first year is the LQTY that is publically issued to Stability Pool depositors via the `CommunityIssuance` contract.

### Lockup Implementation and admin transfer restriction

A `LockupContractFactory` is used to deploy `OneYearLockupContracts` in the first year. During the first year, the `GrowthToken` checks that any transfer from the Liquity admin address is to a valid `OneYearLockupContract` that is registered in and was deployed through the `LockupContractFactory`.

After the first year, anyone may deploy `CustomDurationLockupContracts` via the factory.

### Launch sequence and vesting process

#### Deploy LQTY Contracts
1. Liquity admin deploys `LockupContractFactory`
2. Liquity admin deploys `CommunityIssuance`
3. Liquity admin deploys `LQTYStaking` 
4. Liquity admin deploys `GrowthToken`, which upon deployment:
- Stores the `CommunityIssuance` and `LockupContractFactory` addresses
- Mints LQTY tokens to `CommunityIssuance` and the Liquity admin address
5. Liquity admin sets `GrowthToken` address in `LockupContractFactory`, `CommunityIssuance`, and `LQTYStaking`

#### Deploy and fund Lockup Contracts
6. Liquity admin tells `LockupContractFactory` to deploy a `OneYearLockupContract` for each (beneficiary, entitlement) pair, including one for the Liquity admin address
7. Liquity admin transfers LQTY to each `OneYearLockupContract`, equal to its beneficiary’s entitlement
8. Liquity admin calls `lockOneYearContracts()` on the Factory, telling it to lock and activate all the `OneYearLockupContracts` that Liquity admin deployed

#### Deploy Liquity Core
9. Liquity admin deploys the Liquity core system
10. Liquity admin connects Liquity core system internally (with setters), and connects each of the `LQTYStaking` and `CommunityIssuance` contracts with Liquity core contracts
11. Liquity admin activates the `CommunityIssuance` contract

#### During one year lockup period
- Liquity admin periodically transfers newly vested tokens to team & partners’ `OneYearLockupContracts`, as per their vesting schedules
- Liquity admin may only transfer LQTY to `OneYearLockupContracts`
- Anyone may deploy new `OneYearLockupContracts` via the Factory

#### Upon end of lockup period
- All `OneYearLockupContracts` automatically unlock. Beneficiaries may withdraw their entire unlocked entitlements
- Liquity admin address restriction on LQTY transfers is automatically lifted, and Liquity admin may now transfer LQTY to any address
- Anyone may deploy new `OneYearLockupContracts` and `CustomDurationLockupContracts` via the Factory

#### Post-lockup period
- Liquity admin periodically transfers newly vested tokens to team & partners, directly to their individual addresses, or to a fresh lockup contract if required.

## Core System Architecture

The core Liquity system consists of several smart contracts, which are deployable to the Ethereum blockchain.

All application logic and data is contained in these contracts - there is no need for a separate database or back end logic running on a web server. In effect, the Ethereum network is itself the Liquity back end. As such, all balances and contract data are public.

The system has no admin key or human governance. Once deployed, it is fully automated, decentralized and no user holds any special privileges in or control over the system.

The three main contracts - `BorrowerOperations.sol`, `TroveManager.sol` and `PoolManager.sol` - hold the user-facing public functions, and contain most of the internal system logic. Together they control trove state updates and movements of Ether and tokens around the system.

### Core Smart Contracts

`BorrowerOperations.sol` - contains the basic operations by which borrowers interact with their trove: loan creation, ETH top-up / withdrawal, stablecoin issuance and repayment. BorrowerOperations functions call in to TroveManager, telling it to update trove state, where necessary. BorrowerOperations functions also call in to PoolManager, telling it to move Ether and/or tokens between Pools, where necessary.

`TroveManager.sol` - contains functionality for liquidations and redemptions. Also contains the state of each trove - i.e. a record of the trove’s collateral and debt. TroveManager does not hold value (i.e. Ether / other tokens). TroveManager functions call in to PooManager to tell it to move Ether/tokens between Pools, where necessary.

`LiquityBase.sol` - Both TroveManager and BorrowerOperations inherit from the parent contract LiquityBase, which contains global constants and some common functions.

`PoolManager.sol` - contains functionality for Stability Pool operations: making deposits, and withdrawing compounded deposits and accumulated ETH rewards. It also directs the transfers of Ether and tokens between Pools.

`LUSDToken.sol` - the stablecoin token contract, which implements the ERC20 fungible token standard. The contract mints, burns and transfers LUSD tokens.

`SortedTroves.sol` - a doubly linked list that stores addresses of trove owners, sorted by their individual collateral ratio (ICR). It inserts and re-inserts troves at the correct position, based on their ICR.

**TODO: Description of PriceFeed.sol to be eventually updated.**

`PriceFeed.sol` - Contains functionality for obtaining the current ETH:USD price, which the system uses for calculating collateral ratios. Currently, the price is a state variable that can be manually set by the admin. The PriceFeed contract will eventually store no price data, and when called from within other Liquity contracts, will automatically pull the current and decentralized ETH:USD price data from the Chainlink contract.

`HintHelpers.sol` - Helper contract, containing the read-only functionality for calculation of accurate hints to be supplied to borrower operations and redemptions.

### Data and Value Silo Contracts

These contracts hold Ether and/or tokens for their respective parts of the system, and contain minimal logic.

`LUSDTokenData.sol` - contains the record of stablecoin balances for all addresses.

`StabilityPool.sol` - holds an ERC20 balance of all stablecoin tokens deposits, and the total ether balance of all the ETH earned by depositors.

`ActivePool.sol` - holds the total Ether balance and records the total stablecoin debt of the active troves.

`DefaultPool.sol` - holds the total Ether balance and records the total stablecoin debt of the liquidated loans that are pending redistribution to active troves. If a trove has pending ether/debt “rewards” in the DefaultPool, then they will be applied to the trove when it next undergoes a borrower operation, a redemption, or a liquidation.

### Contract Interfaces

`ITroveManager.sol`, `IPool.sol` etc. These provide specification for a contract’s functions, without implementation. They are similar to interfaces in Java or C#.

### PriceFeed and Oracle

Liquity functions that require the most current ETH:USD price data fetch the price dynamically, as needed, via the core `PriceFeed.sol` contract.

**TODO: To be updated**
Currently, provisional plans are to use the Chainlink ETH:USD reference contract for the price data source, however, other options are under consideration.

The current PriceFeed contract is a placeholder and contains a manual price setter, `setPrice()`. Price can be manually set, and `getPrice()` returns the latest stored price. In the final deployed version, no price will be stored or set, and `getPrice()` will fetch the latest ETH:USD price from the Chainlink reference contract.

### Keeping a sorted list of troves ordered by ICR

Liquity relies on a particular data structure: a sorted doubly-linked list of troves that remains ordered by individual collateral ratio (ICR), i.e. the amount of collateral (in USD) divided by the amount of debt (in LUSD).

This ordered list is critical for gas-efficient redemption sequences and for the `liquidateTroves` sequence, both of which target troves in ascending order of ICR.

The sorted doubly-linked list is found in `SortedTroves.sol`. 

Nodes map to active troves in the system - the ID property is the address of a trove owner. The list accepts positional hints for efficient O(1) insertion - please see the [hints](#supplying-hints-to-cdp-operations) section for more details.

ICRs are computed dynamically at runtime, and not stored on the node. This is because ICRs of active troves change dynamically, when:

- The ETH:USD price varies, altering the USD of the collateral of every trove
- A liquidation that redistributes collateral and debt to active troves occurs

The list relies on the fact that a collateral and debt redistribution due to a liquidation preserves the ordering of all active troves (though it does decrease the ICR of each active trove above the MCR).

The fact that ordering is maintained as redistributions occur, is not immediately obvious: please see the [mathematical proof](https://github.com/liquity/dev/tree/master/packages/contracts/mathProofs) which shows that this holds in Liquity.

A node inserted based on current ICR will maintain the correct position, relative to its peers, as liquidation gains accumulate, as long as its raw collateral and debt have not changed.

Nodes also remain sorted as the ETH:USD price varies, since price fluctuations change the collateral value of each trove by the same proportion.

Thus, nodes need only be re-inserted to the sorted list upon a trove operation - when the owner adds or removes collateral or debt to their position.

### Flow of Ether in Liquity

Ether in the system lives in three Pools: the ActivePool, the DefaultPool and the StabilityPool. When an operation is made, Ether is transferred in one of three ways:

**TODO:Check against https://github.com/liquity/dev/pull/72/commits and maybe add a flow chart?**

- From a user to a Pool
- From a Pool to a user
- From one Pool to another Pool

Ether is recorded on an _individual_ level, but stored in _aggregate_ in a Pool. An active trove with collateral and debt has a struct in the TroveManager that stores its ether collateral value in a uint, but its actual Ether is in the balance of the ActivePool contract.

Likewise, a StabilityPool depositor who has earned some ETH gain from their deposit will have a computed ETH gain based on a variable in the PoolManager. But their actual withdrawable Ether is in the balance of the StabilityPool contract.

**Borrower Operations**

**TODO: To be reviewed and updated according to https://github.com/liquity/dev/issues/60**

| Function                    | ETH quantity       | Path                                    |
| --------------------------- | ------------------ | --------------------------------------- |
| openTrove                   | msg.value          | msg.sender -> PoolManager -> ActivePool |
| addColl                     | msg.value          | msg.sender -> PoolManager -> ActivePool |
| withdrawColl                | \_amount parameter | ActivePool -> msg.sender                |
| adjustTrove: adding ETH     | msg.value          | msg.sender -> PoolManager -> ActivePool |
| adjustTrove: withdrawing ETH| \_amount parameter | ActivePool -> msg.sender                |
| closeLoan                   | \_amount parameter | ActivePool -> msg.sender                |

**Trove Manager**

| Function                   | ETH quantity                   | Path                        |
| -------------------------- | ------------------------------ | --------------------------- |
| liquidate (offset)         | collateral to be offset        | ActivePool -> StabilityPool |
| liquidate (redistribution) | collateral to be redistributed | ActivePool -> DefaultPool   |
| redeemCollateral           | collateral to be swapped       | ActivePool -> msg.sender    |

**Pool Manager**

| Function              | ETH quantity                 | Path                                                                         |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| provideToSP           | depositor's current ETH gain | StabilityPool -> msg.sender                                                  |
| withdrawFromSP        | depositor's current ETH gain | StabilityPool -> msg.sender                                                  |
| withdrawFromSPtoTrove | depositor's current ETH gain | StabilityPool -> PoolManager -> BorrowerOperations -> PoolManager -> ActivePool |

### Flow of ERC20 tokens in Liquity

When a user issues debt from their trove, LUSD tokens are minted to their own address, and a debt is recorded on the trove. Conversely, when they repay their trove’s LUSD debt, LUSD is burned from their address, and the debt on their trove is reduced.

Redemptions burn LUSD from the redeemer’s balance, and reduce the debt of the trove redeemed against.

Liquidations that involve a Stability Pool offset burn tokens from the Stability Pool’s balance, and reduce the LUSD debt of the liquidated trove.

The only time LUSD is transferred to/from a Liquity contract, is when a user deposits LUSD to, or withdraws LUSD from, the StabilityPool.

**Borrower Operations**

| Function                    | ERC20 Operation                        |
| --------------------------- | -------------------------------------- |
| openLoan                    | ERC20.\_mint(msg.sender, \_LUSDAmount) |
| withdrawLUSD                | ERC20.\_mint(msg.sender, \_LUSDAmount) |
| repayLUSD                   | ERC20.\_burn(msg.sender, \_LUSDAmount) |
| adjustLoan: withdrawing LUSD| ERC20.\_mint(msg.sender, \_LUSDAmount) |
| adjustLoan: repaying LUSD   | ERC20.\_burn(msg.sender, \_LUSDAmount) |
| closeLoan                   | ERC20.\_burn(msg.sender, \_LUSDAmount) |

**Trove Manager**

| Function           | ERC20 Operation                                     |
| ------------------ | --------------------------------------------------- |
| liquidate (offset) | ERC20.\_burn(stabilityPoolAddress, \_debtToOffset)  |
| redeemCollateral   | ERC20.\_burn(msg.sender, \_LUSD)                    |

**Pool Manager**

| Function       | ERC20 Operation                                              |
| -------------- | ------------------------------------------------------------ |
| provideToSP    | ERC20.\_transfer(msg.sender, stabilityPoolAddress, \_amount) |
| withdrawFromSP | ERC20.\_transfer(stabilityPoolAddress, msg.sender, \_amount) |

## Expected User Behaviors

Generally, borrowers call functions that trigger trove operations on their own trove. Stability Pool users (who may or may not also be borrowers) call functions that trigger Stability Pool operations, such as depositing or withdrawing tokens to/from the Stability Pool.

Anyone may call the public liquidation functions, and attempt to liquidate one or several troves.

LUSD token holders may also redeem their tokens, and swap an amount of tokens 1-for-1 in value with Ether.

## Contract Ownership and Function Permissions

All the core smart contracts inherit from the OpenZeppelin `Ownable.sol` contract template. As such all contracts have a single owning address, which is the deploying address.

Several public and external functions have modifiers such as `onlyTroveManager`, `onlyPoolManager`, etc - ensuring they can only be called by the respective permitted contract.

## Deployment to a Development Blockchain

**TODO: Check if this is still up to date**

The Buidler migrations script and deployment helpers deploy all contracts, and connect all contracts to their dependency contracts, by setting the necessary deployed addresses.

The project is deployed on the Ropsten testnet.

## Running Tests

Run all tests with `npx buidler test`, or run a specific test with `npx buidler test ./test/contractTest.js`

Tests are run against the Buidler EVM.

## System Quantities - Units and Representation

Below are all quantity state variables used in Liquity, along with their type, representation and unit.

| Contract          | type     | Quantity                 | Description                                                                       | Representation           | Units                      |
| ----------------- | -------- | ------------------------ | --------------------------------------------------------------------------------- | ------------------------ | -------------------------- |
| **ActivePool**    | uint256  | ETH                      | Total ETH in all active troves                                                    | integer                  | wei (E)                    |
|                   | uint256  | TroveDebt                | Total outstanding LUSD Debt in active troves                                      | integer                  | attoLUSD (C)               |
| **DefaultPool**   | uint256  | ETH                      | Total liquidated ETH, pending reward                                              | integer                  | wei (E)                    |
|                   | uint256  | TroveDebt                | Total closed LSUD debt, pending reward                                            | integer                  | attoLUSD (C)               |
| **StabilityPool** | uint256  | ETH                      | Total accumulated ETH Gains from StabilityPool                                    | integer                  | wei (E)                    |
|                   | uint256  | totalLUSDDeposits        | Total current LUSD deposits                                                       | integer                  | attoLUSD (C)               |
|                   |          |                          |                                                                                   |                          |                            |
| **PriceFeed**     | uint256  | price                    | The last recorded price of 1 Ether, in USD                                        | 18 digit decimal         | dollars per ether (\$ / E) |
|                   |          |                          |                                                                                   |                          |                            |
| **TroveManager**    | constant | MCR                    | Minimum collateral ratio                                                          | 18 digit decimal         | none ( $ / $)              |
|                   | constant | CCR                      | Critical collateral ratio                                                         | 18 digit decimal         | none ( $ / $)              |
|                   | uint256  | totalStakes              | Sum of all trove stakes                                                           | integer                  | wei (E)                    |
|                   | uint256  | totalStakesSnapshot      | Snapshot of totalStakes at last liquidation                                       | integer                  | wei (E)                    |
|                   | uint256  | totalCollateralSnapshot  | Snapshot of totalCollateral at last liquidation                                   | integer                  | wei (E)                    |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | L_ETH                    | Accumulated ETH reward-per-unit-staked for troves                                 | 18 digit decimal         | none (E / E)               |
|                   | uint256  | L_TroveDebt              | Accumulated LUSD Debt reward-per-unit-staked for troves                           | 18 digit decimal         | Trove Debt per ether (C / E) |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | lastETHError_Redist.     | Error tracker for the ETH error correction in \_redistributeDebtAndColl()         | 18 digit decimal \* 1e18 | Ether (E)                  |
|                   | uint256  | lastLUSDDebtError_Redist.| Error tracker for the LUSD Debt error correction in \_redistributeDebtAndColl()   | 18 digit decimal \* 1e18 | LUSD (C)                   |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | Trove[user].debt         | User's trove debt                                                                 | integer                  | attoLUSD (C)               |
|                   | uint256  | Trove[user].coll         | User's trove collateral                                                           | integer                  | wei (E)                    |
|                   | uint256  | Trove[user].stake        | User's trove stake                                                                | integer                  | wei (E)                    |
|                   | uint256  | Trove[user].arrayIndex     | User's index in the trove owners array                                          | integer                  | none                       |
|                   |          |                          |                                                                                   |                          |                            |
|                   |          |                          |                                                                                   |                          |                            |
| **PoolManager**   | uint256  | epochToScaleToSum[S]     | Sum term for the accumulated ETH gain per-unit-deposited                          | 18 digit decimal \* 1e18 | Ether per LUSD (E / C)      |
|                   | uint256  | P                        | Product term for the compounded-deposit-per-unit-deposited                        | 18 digit decimal         | none (C / C)               |
|                   | uint256  | currentScale             | The number of times the scale of P has shifted by 1e-18                           | integer                  | none                       |
|                   | uint256  | currentEpoch             | The number of times the Stability Pool has been fully emptied by a liquidation    | integer                  | none                       |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | lastETHError_Offset      | error tracker for the ETH error correction in \_computeRewardsPerUnitStaked()     | 18 digit decimal \* 1e18 | Ether (E)                  |
|                   | uint256  | lastLUSDLossError_Offset | error tracker for the LUSD Loss error correction in \_computeRewardsPerUnitStaked() | 18 digit decimal \* 1e18 | LUSD (C)                   |
|                   |          |                          |                                                                                   |                          |                            |
| **BorrowerOps**   | constant | MCR                      | Minimum collateral ratio.                                                         | 18 digit decimal         | none ( $ / $)              |
|                   | constant | CCR                      | Critical collateral ratio.                                                        | 18 digit decimal         | none ( $ / $)              |
|                   | constant | MIN_COLL_IN_USD          | Minimum collateral value (in USD) for opening loan                                | 18 digit decimal         | none ( $ / $)              |

### Integer representations of decimals

Several ratios and the ETH:USD price are integer representations of decimals, to 18 digits of precision. For example:

| **uint representation of decimal** | **Number**    |
| ---------------------------------- | ------------- |
| 1100000000000000000                | 1.1           |
| 200000000000000000000              | 200           |
| 1000000000000000000                | 1             |
| 5432100000000000000                | 5.4321        |
| 34560000000                        | 0.00000003456 |
| 370000000000000000000              | 370           |
| 1                                  | 1e-18         |

etc.

## Public Data

All data structures with the ‘public’ visibility specifier are ‘gettable’, with getters automatically generated by the compiler. Simply call `TroveManager::MCR()` to get the MCR, etc.

## Public User-Facing Functions

### Borrower (Trove) Operations - _BorrowerOperations.sol_

**TODO: To be reviewed and updated according to https://github.com/liquity/dev/issues/60**

`openTrove(uint _LUSDAmount)`: payable function that creates a trove for the caller with the requested debt, and the ether received as collateral. Successful execution is conditional mainly on the resulting collateral ratio which must exceed the minimum (110% in Normal Mode).

`addColl(address _user, address _hint)`: payable function that adds the received Ether to the given user’s active trove. Allows any user to add Ether to any other user’s trove.

`withdrawColl(uint _amount, address _hint)`: withdraws `_amount` of collateral from the caller’s trove. Executes only if the user has an active trove, the system is in Normal Mode, and the withdrawal would not pull the user’s trove below the minimum collateral ratio. 

`withdrawLUSD(uint _amount, address_hint)`: issues `_amount` of LUSD from the caller’s trove to the caller. Executes only if the resultant collateral ratio would remain above the minimum and the system is and would remain in Normal Mode after the withdrawal. 

`repayLUSD(uint _amount, uint _hint)`: repay `_amount` of LUSD to the caller’s trove.

`adjustTrove(uint _collWithdrawal, int _debtChange, address _hint)`: enables a borrower to simultaneously change both their collateral and debt, subject to all the restrictions that apply to individual increases/decreases of each quantity.

`closeTrove()`: allows a borrower to repay all debt, withdraw all their collateral, and close their trove.

### TroveManager Functions - _TroveManager.sol_

`liquidate(address _user)`: callable by anyone, attempts to liquidate the trove of `_user`. Executes successfully if `_user`’s trove meets the conditions for liquidation (e.g. in Normal Mode, it liquidates if the trove's ICR < the system MCR).  

`liquidateTroves(uint n)`: callable by anyone, checks for under-collateralised troves below MCR and liquidates up to `n`, starting from the trove with the lowest collateral ratio; subject to gas constraints and the actual number of under-collateralized troves. The gas costs of `liquidateTroves(uint n)` mainly depend on the number of troves that are liquidated, and whether the troves are offset against the Stability Pool or redistributed. For n=1, the gas costs per liquidated trove are roughly between 240K-400K, for n=5 between 88K-113K, for n=10 between 78K-85K, and for n=40 between 66K-72K.

`batchLiquidateTroves( address[] calldata troveList)`: callable by anyone, accepts a custom list of troves addresses as an argument. Steps through the provided list and attempts to liquidate every trove, until it reaches the end or it runs out of gas. A trove is liquidated only if it meets the conditions for liquidation. For a batch of 10 troves, the gas costs per liquidated trove are roughly between 75K-83K, for a batch of 50 troves between 54K-69K.

`redeemCollateral(uint _LUSDamount, address _firstRedemptionHint, address _partialRedemptionHint, uint _partialRedemptionHintICR)`: redeems `_LUSDamount` of stablecoins for ether from the system. Decreases the caller’s LUSD balance, and sends them the corresponding amount of ETH. Executes successfully if the caller has sufficient LUSD to redeem.

`getCurrentICR(address _user, uint _price)`: computes the user’s individual collateral ratio (ICR) based on their total collateral and total LUSD debt. Returns 2^256 -1 if they have 0 debt.

`getTroveOwnersCount()`: get the number of active troves in the system.

`getPendingETHReward(address _user)`: get the pending ETH reward from liquidation redistribution events, for the given trove.

`getPendingTroveDebtReward(address _user)`: get the pending trove debt "reward" (i.e. the amount of extra debt assigned to the trove) from liquidation redistribution events.

`getTCR()`: returns the total collateral ratio (TCR) of the system.  The TCR is based on the the entire system debt and collateral (including pending rewards).

`checkRecoveryMode()`: reveals whether or not the system is in Recovery Mode (i.e. whether the Total Collateral Ratio (TCR) is below the Critical Collateral Ratio (CCR)).

### Price Feed Functions - _PriceFeed.sol_

**TODO: add function descriptions here once finalized**

### Hint Helper Functions - _HintHelpers.sol_

`getApproxHint(uint _CR, uint _numTrials)`: helper function, returns a positional hint for the sorted list. Used for transactions that must efficiently re-insert a trove to the sorted list.

`getRedemptionHints(uint _LUSDamount, uint _price)`: helper function specifically for redemptions. Returns two hints - the first is positional, the second ensures transaction success (see [Hints for `redeemCollateral`](#hints-for-redeemcollateral)).

### Stability Pool Functions - _PoolManager.sol_

`provideToSP(uint _amount)`: allows stablecoin holders to deposit `_amount` of LUSD to the Stability Pool. If they already have tokens in the pool, it sends all accumulated ETH gains to their address. It tops up their LUSD deposit by `_amount`, and reduces their LUSD balance by `_amount`. This function automatically withdraws the user's entire accumulated ETH gain from the Stability Pool to their address.

`withdrawFromSP(uint _amount)`: allows a stablecoin holder to withdraw `_amount` of LUSD from the Stability Pool, up to the value of their remaining Stability deposit. Sends all their accumulated ETH gains to their address, and increases their LUSD balance by `_amount`. If the user makes a partial withdrawal, their deposit remainder will earn further rewards.

`withdrawFromSPtoTrove(address _user, address _hint)`: sends the user's entire accumulated ETH gain to the user's active trove, and updates their Stability deposit with its accumulated loss from debt absorptions. If called by an externally owned account, the argument \_user must be the calling account.

`getTCR()`: returns the Total Collateral Ratio (TCR) of the system, based on the entire (active and defaulted) debt, and the entire (active and defaulted) collateral

`getCurrentETHGain(address _user)`: returns the accumulated ETH gain for a given Stability Pool depositor

`getCompoundedLUSDDeposit(address _user)`: returns the remaining deposit amount for a given Stability Pool depositor

### Individual Pool Functions - _StabilityPool.sol_, _ActivePool.sol_, _DefaultPool.sol_

`getRawEtherBalance()`: returns the actual raw Ether balance of the contract. Distinct from the ETH ([public variable](#public-data)), which returns the total recorded ETH deposits.

## Supplying Hints to trove operations

Troves in Liquity are recorded in a sorted doubly linked list, sorted by their ICR, from high to low.

All trove operations that change the collateral ratio need to either insert or reinsert the trove to the `SortedTroves` list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, a ‘hint’ may be provided.

A hint is the address of a trove with a position in the sorted list close to the correct insert position.

All trove operations take a ‘hint’ argument. The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call.

The `TroveManager::getApproxHint(...)` function can be used to generate a useful hint, which can then be passed as an argument to the desired trove operation or to `SortedTroves::findInsertPosition(...)` to get an exact hint.

`getApproxHint(uint _CR, uint _numTrials, uint _price, uint _inputRandomSeed)` randomly selects `numTrials` amount of troves, and returns the one with the closest position in the list to where a trove with a collateral ratio of `CR` should be inserted. It can be shown mathematically that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst case `O(sqrt(n)) if k >= 10`. For scalability reasons (Infura is able to serve up to ~4900 trials), the function also takes a random seed `_inputRandomSeed` to make sure that calls with different seeds may lead to a different results, allowing for better approximations through multiple consecutive runs. **TODO: check if `_price` parameter is really needed. If yes, add a short explanation.**

**Trove operation without a hint**

1. User performs trove operation in their browser
2. Call the trove operation with `_hint = userAddress`

Gas cost will be worst case `O(n)`, where n is the size of the `SortedTroves` list.

**Trove operation with hint**

1. User performs trove operation in their browser
2. The front end computes a new collateral ratio locally, based on the change in collateral and/or debt.
3. Call `TroveManager::getApproxHint(...)`, passing it the computed collateral ratio. Returns an address close to the correct insert position
4. Call `SortedTroves::findInsertPosition(uint256 _ICR, address _prevId, address _nextId)`, passing it the approximate hint via both `_prevId` and `_nextId` and the new collateral ratio via `_ICR`. **TODO: To be updated according to https://github.com/liquity/dev/issues/91**
5. Pass the exact position as an argument to the trove operation function call. (Note that the hint may become slightly inexact due to pending transactions that are processed first, though this is gracefully handled by the system.)

Gas cost of steps 2-4 will be free, and step 5 will be `O(1)`.

Hints allow cheaper trove operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to Infura, unless the front end operator is running a full Ethereum node.

Each BorrowerOperations function that reinserts a troves takes a single hint, as does `PoolManager::withdrawFromSPtoTrove(...)`.

### Hints for `redeemCollateral`

`TroveManager::redeemCollateral` as a special case requires two hints. The first hint provides an accurate reinsert position (as described above), and the second hint ensures the transaction succeeds.

**TODO: To be reviewed and updated once https://github.com/liquity/dev/issues/106 is fixed**

All troves that are fully redeemed from in a redemption sequence are left with zero debt, and are reinserted at the top of the SortedTroves list.

It’s likely that the last trove in the redemption sequence would be partially redeemed from - i.e. only some of its debt cancelled with LUSD. In this case, it should be reinserted somewhere between top and bottom of the list. The first hint passed to `redeemCollateral` gives the expected reinsert position.

However, if between the off-chain hint computation and on-chain execution a different transaction changes the state of a trove that would otherwise be hit by the redemption sequence, then the off-chain hint computation could end up totally inaccurate. This could lead to the whole redemption sequence reverting due to out-of-gas error.

To mitigate this, a second hint needs to be provided: the expected ICR of the final partially-redeemed-from trove. The on-chain redemption function checks whether, after redemption, the ICR of this trove would equal the ICR hint.

If not, the redemption sequence doesn’t perform the final partial redemption, and terminates early. This ensures that the transaction doesn’t revert, and most of the requested LUSD redemption can be fulfilled.

## Gas compensation

In Liquity, we want to maximize liquidation throughput, and ensure that undercollateralized troves are liquidated promptly by “liquidators” - agents who may also hold Stability Pool deposits, and who expect to profit from liquidations.

However, gas costs in Ethereum are substantial. If the gas costs of our public liquidation functions are too high, this may discourage liquidators from calling them, and leave the system holding too many undercollateralized troves for too long.

The protocol thus directly compensates liquidators for their gas costs, to incentivize prompt liquidations in both normal and extreme periods of high gas prices. Liquidators should be confident that they will at least break even by making liquidation transactions.

Gas compensation is paid in a mix of LUSD and ETH. While the ETH is taken from the liquidated trove, the LUSD is provided by the borrower. When a borrower first issues debt, some LUSD is reserved for gas compensation. A liquidation transaction thus draws ETH from the trove(s) it liquidates, and sends the both the reserved LUSD and the compensation in ETH to the caller, and liquidates the remainder.

When a liquidation transaction liquidates multiple troves, each trove contributes LUSD and ETH towards the total compensation for the transaction.

Gas compensation per liquidated trove is given by the formula:

Gas compensation = `10 LUSD + 0.5% of trove’s collateral (ETH)`

The intentions behind this formula are:
- To ensure that smaller troves are liquidated promptly in normal times, at least
- To ensure that larger troves are liquidated promptly even in extreme high gas price periods. The larger the trove, the stronger the incentive to liquidate it.

### Gas compensation schedule

When a borrower opens a loan, an additional 10 LUSD debt is issued, and 10 LUSD is minted and sent to a dedicated externally owned account (EOA) for gas compensation - the "gas address".

When a borrower closes their active trove, this gas compensation is refunded: 10 LUSD is burned from the gas address's balance, and the corresponding 10 LUSD debt on the trove is cancelled.

The purpose of the 10 LUSD debt is to provide a minimum level of gas compensation, regardless of the trove's collateral size or the current ETH price.

### Liquidation

When a trove is liquidated, 0.5% of its collateral is sent to the liquidator, along with the 10 LUSD reserved for gas compensation. Thus, a liquidator always receives `{10 LUSD + 0.5% collateral}` per trove that they liquidate. The collateral remainder of the trove is then either offset, redistributed or a combination of both, depending on the amount of LUSD in the Stability Pool.

#### Edge case: Gas compensation in a partial liquidation in Recovery Mode

A trove can be partially liquidated under specific conditions:

- Recovery mode is active: TCR < 150%  
- 110% <= trove ICR < TCR
- trove debt > LUSD in Stability Pool

In this case, a partial offset occurs: the entire LUSD in the Stability Pool is offset with an equal amount of the trove's debt, which is only a fraction of its total debt. A corresponding fraction of the trove's collateral is liquidated (sent to the Stability Pool).

The trove is left with some LUSD Debt and collateral remaining.

For the purposes of a partial liquidation, only the amount (debt - 10) is considered. If the LUSD in the Stability Pool is >= (debt - 10), a full liquidation
is performed.

In a partial liquidation, the ETH gas compensation is 0.5% of the _collateral fraction_ that corresponds to the partial offset.

### Gas compensation and redemptions

When a trove is redeemed from, the redemption is made only against (debt - 10), not the entire debt.

**TODO: To be reviewed and updated once https://github.com/liquity/dev/issues/106 is fixed**

But if the redemption causes an amount (debt - 10) to be cancelled, the trove is then closed: the 10 LUSD gas compensation is cancelled with its corresponding 10 LUSD debt, and the ETH surplus in the trove is sent back to the owner.


## Gas compensation Functionality

Gas compensation functions are found in the parent _LiquityBase.sol_ contract:

`_getCollGasCompensation(uint _entireColl)`

`_getCompositeDebt(uint _debt)`

## The Stability Pool

Any LUSD holder may deposit LUSD to the Stability Pool. It is designed to absorb debt from liquidations, and reward depositors with the liquidated collateral, shared between depositors in proportion to their deposit size.

Since liquidations are expected to occur at an ICR of just below 110%, and even in most extreme cases, still above 100%, a depositor can expect to receive a net gain from most liquidations. When that holds, the dollar value of the ETH gain from a liquidation exceeds the dollar value of the LUSD loss (assuming the price of LUSD is $1).  

We define the **collateral surplus** in a liquidation as `$(ETH) - debt`, where `$(...)` represents the dollar value.

At an LUSD price of $1, troves with `ICR > 100%` have a positive collateral surplus.

After one or more liquidations, a deposit will have absorbed LUSD losses, and received ETH gains. The remaining reduced deposit is the **compounded deposit**.

Stability Pool depositors expect a positive ROI on their initial deposit. That is:

`$(ETH Gain + compounded deposit) > $(initial deposit)`

### Mixed liquidations: offset and redistribution

When a liquidation hits the Stability Pool, it is known as an **offset**: the debt of the trove is offset against the LUSD in the Pool. When **x** LUSD debt is offset, the debt is cancelled, and **x** LUSD in the Pool is burned. When the LUSD Stability Pool is greater than the debt of the trove, all the trove's debt is cancelled, and all its ETH is shared between depositors. This is a **pure offset**.

It can happen that the LUSD in the Stability Pool is less than the debt of a trove. In this case, the the whole Stability Pool will be used to offset a fraction of the trove’s debt, and an equal fraction of the trove’s ETH collateral will be assigned to Stability Pool depositors. The remainder of the trove’s debt and ETH gets redistributed to active troves. This is a **mixed offset and redistribution**.

Because the ETH collateral fraction matches the offset debt fraction, the effective ICR of the collateral and debt that is offset, is equal to the ICR of the trove. So, for depositors, the ROI per liquidation depends only on the ICR of the liquidated trove.

### Stability Pool deposit losses and ETH gains - implementation

Deposit functionality is handled by `PoolManager.sol` (`provideToSP`, `withdrawFromSP`, etc).  PoolManager also handles the liquidation calculation. `StabilityPool.sol` actually holds the LUSD and ETH balances.

When a liquidation is offset with the Stability Pool, debt from the liquidation is cancelled with an equal amount of LUSD in the pool, which is burned. 

Individual deposits absorb the debt from the liquidated trove in proportion to their deposit as a share of total deposits.
 
Similarly the liquidated trove’s ETH is assigned to depositors in the same proportion.

For example: a liquidation that empties 30% of the Stability Pool will reduce each deposit by 30%, no matter the size of the deposit.

### Stability Pool example

Here’s an example of the Stability Pool absorbing liquidations. The Stability Pool contains 3 depositors, A, B and C, and the ETH:USD price is 100.

There are two troves to be liquidated, T1 and T2:

|   | Trove | Collateral (ETH) | Debt (LUSD) | ICR         | $(ETH) ($) | Collateral surplus ($) |
|---|-------|------------------|-------------|-------------|------------|------------------------|
|   | T1    | 1.6              | 150         | 1.066666667 | 160        | 10                     |
|   | T2    | 2.45             | 225         | 1.088888889 | 245        | 20                     |

Here are the deposits, before any liquidations occur:

| Depositor | Deposit | Share  |
|-----------|---------|--------|
| A         | 100     | 0.1667 |
| B         | 200     | 0.3333 |
| C         | 300     | 0.5    |
| Total     | 600     | 1      |

Now, the first liquidation T1 is absorbed by the Pool: 150 debt is cancelled with 150 Pool LUSD, and its 1.6 ETH is split between depositors. We see the gains earned by A, B, C, are in proportion to their share of the total LUSD in the Stability Pool:

| Deposit | Debt absorbed from T1 | Deposit after | Total ETH gained | $(deposit + ETH gain) ($) | Current ROI   |
|---------|-----------------------|---------------|------------------|---------------------------|---------------|
| A       | 25                    | 75            | 0.2666666667     | 101.6666667               | 0.01666666667 |
| B       | 50                    | 150           | 0.5333333333     | 203.3333333               | 0.01666666667 |
| C       | 75                    | 225           | 0.8              | 305                       | 0.01666666667 |
| Total   | 150                   | 450           | 1.6              | 610                       | 0.01666666667 |

And now the second liquidation, T2, occurs: 225 debt is cancelled with 225 Pool LUSD, and 2.45 ETH is split between depositors. The accumulated ETH gain includes all ETH gain from T1 and T2.

| Depositor | Debt absorbed from T2 | Deposit after | Accumulated ETH | $(deposit + ETH gain) ($) | Current ROI |
|-----------|-----------------------|---------------|-----------------|---------------------------|-------------|
| A         | 37.5                  | 37.5          | 0.675           | 105                       | 0.05        |
| B         | 75                    | 75            | 1.35            | 210                       | 0.05        |
| C         | 112.5                 | 112.5         | 2.025           | 315                       | 0.05        |
| Total     | 225                   | 225           | 4.05            | 630                       | 0.05        |

It’s clear that:

- Each depositor gets the same ROI from a given liquidation
- Depositors return increases over time, as the deposits absorb liquidations with a positive collateral surplus

Eventually, a deposit can be fully “used up” in absorbing debt, and reduced to 0. This happens whenever a liquidation occurs that empties the Stability Pool. A deposit stops earning ETH gains when it has been reduced to 0.


### Stability Pool implementation

A depositor obtains their compounded deposits and corresponding ETH gain in a “pull-based” manner. The system calculates the depositor’s compounded deposit and accumulated ETH gain when the depositor makes an operation that changes their ETH deposit.

Depositors deposit LUSD via `provideToSP`, and withdraw with `withdrawFromSP`. Their accumulated ETH gain is paid out every time they make a deposit operation - so ETH payout is triggered by both deposit withdrawals and top-ups.

### How deposits and ETH gains are tracked

We use a highly scalable method of tracking deposits and ETH gains that has O(1) complexity. 

When a liquidation occurs, rather than updating each depositor’s deposit and ETH gain, we simply update two intermediate variables: a product `P`, and a sum `S`.

A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors’ compounded deposits and accumulated ETH gains over time, as liquidations occur, using just these two variables. When depositors join the Pool, they get a snapshot of `P` and `S`.

The formula for a depositor’s accumulated ETH gain is derived here:

[Scalable reward distribution for compounding, decreasing stake](https://github.com/liquity/dev/blob/main/packages/contracts/mathProofs/Scalable%20Compounding%20Stability%20Pool%20Deposits.pdf)

Each liquidation updates `P` and `S`. After a series of liquidations, a compounded deposit and corresponding ETH gain can be calculated using the initial deposit, the depositor’s snapshots, and the current values of `P` and `S`.

Any time a depositor updates their deposit (withdrawal, top-up) their ETH gain is paid out, and they receive new snapshots of `P` and `S`.

This is similar in spirit to the simpler [Scalable Reward Distribution on the Ethereum Network by Bogdan Batog et al](http://batog.info/papers/scalable-reward-distribution.pdf), however, the mathematics is more involved as we handle a compounding, decreasing stake, and a corresponding ETH reward.

## LQTY Issuance to Stability Depositors

Stability Pool depositors earn LQTY tokens continuously over time, in proportion to the size of their deposit. This is known as “Community Issuance”, and is handled by `CommunityIssuance.sol`.

Upon system deployment and activation, `CommunityIssuance` holds an initial LQTY supply, currently (provisionally) set at 1/3 of the total 100 million LQTY tokens.

Each Stability Pool deposit is tagged with a front end tag - the Ethereum address of the front end through which the deposit was made. Stability deposits made directly with the protocol (no front end) are tagged with the zero address.

When a deposit earns LQTY, it is split between the depositor, and the front end through which the deposit was made. Upon registering as a front end, a front end chooses a “kickback rate”: this is the percentage of LQTY earned by a tagged deposit, to allocate to the depositor. Thus, the total LQTY received by a depositor is the total LQTY earned by their deposit, multiplied by `kickbackRate`. The front end takes a cut of `1-kickbackRate` of the LQTY earned by the deposit.

### LQTY Issuance schedule

The overall community issuance schedule for LQTY is sub-linear and monotonic. We currently (provisionally) implement a yearly “halving” schedule, described by the cumulative issuance function:

`supplyCap * 1 - 0.5^t` 

where `t` is year and `supplyCap` is (provisionally) set to represent 33.33 million LQTY tokens.

It results in the following cumulative issuance schedule for the community LQTY supply:

| Year | Total community LQTY issued |
|------|-----------------------------|
| 0    | 0%                          |
| 1    | 50%                         |
| 2    | 75%                         |
| 3    | 87.5%                       |
| 4    | 93.75%                      |
| 5    | 96.88%                      |

The shape of the LQTY issuance curve is intended to incentivize both early depositors, and long-term deposits.

Although the LQTY issuance curve follows a yearly halving schedule, in practice the `CommunityIssuance` contract use time intervals of one minute, for more fine-grained reward calculations.

### LQTY Issuance implementation

The continuous time-based LQTY issuance is chunked into discrete reward events, that occur at every deposit change (new deposit, top-up, withdrawal), and every liquidation, before other state changes are made.

In a LQTY reward event, the LQTY to be issued is calculated based on time passed since the last reward event, `block.timestamp - lastLQTYIssuanceTime`, and the cumulative issuance function.

The LQTY produced in this issuance event is shared between depositors, in proportion to their deposit sizes.

To efficiently and accurately track LQTY gains for depositors and front ends as deposits decrease over time from liquidations, we re-use the [algorithm for rewards from a compounding, decreasing stake](https://github.com/liquity/dev/blob/main/packages/contracts/mathProofs/Scalable%20Compounding%20Stability%20Pool%20Deposits.pdf). It is the same algorithm used for the ETH gain from liquidations.

The same product `P` is used, and a sum `G` is used to track LQTY rewards, and each deposit gets a new snapshot of `P` and `G` when it is updated.

### Handling the front end LQTY gain

As mentioned in [LQTY Issuance to Stability Depositors](#lqty-issuance-to-stability-depositors), in a LQTY reward event generating `LQTY_d` for a deposit `d` made through a front end with kickback rate `k`, the front end receives `(1-k) * LQTY_d` and the depositor receives `k * LQTY_d`.

The front end should earn a cut of LQTY gains for all deposits tagged with its front end.

Thus, we use a virtual stake for the front end, equal to the sum of all its tagged deposits. The front end’s accumulated LQTY gain is calculated in the same way as an individual deposit, using the product `P` and sum `G`.

Also, whenever one of the front end’s depositors tops or withdraws their deposit, the same change is applied to the front-end’s stake.

### LQTY reward events and payouts

When a deposit is changed (top-up, withdrawal):

- A LQTY reward event occurs, and `G` is updated
- Its ETH and LQTY gains are paid out
- Its tagged front end’s LQTY gains are paid out to that front end
- The deposit is updated, with new snapshots of `P`, `S` and `G`
- The front end’s stake updated, with new snapshots of `P` and `G`

When a liquidation occurs:
- A LQTY reward event occurs, and `G` is updated

## Liquity System Fees

Liquity generates fee revenue from certain operations. Fees are captured by the LQTY token.

A LQTY holder may stake their LQTY, and earn a share of all system fees, proportional to their share of the total LQTY staked.

Liquity generates revenue in two ways: redemptions, and issuance of new LUSD tokens.

Redemptions fees are paid in ETH. Issuance fees (when a user opens a trove, or issues more LUSD from their existing trove) are paid in LUSD.

### Redemption Fee

The redemption fee is taken as a cut of the total ETH drawn from the system in a redemption.

In the `TroveManager`, `redeemCollateral` calculates the ETH fee and transfers it to the staking contract, `LQTYStaking.sol`

### Issuance fee

The issuance fee is charged on the LUSD drawn by the user and is added to the trove's LUSD debt.

When new LUSD are drawn via one of the `BorrowerOperations` functions `openLoan`, `withdrawLUSD` or `adjustLoan`, an extra amount `LUSDFee` is minted, and an equal amount of debt is added to the user’s trove. The `LUSDFee` is transferred to the staking contract, `LQTYStaking.sol`.

### Fee Schedule

Redemption and issuance fees are based on the `baseRate` state variable in TroveManager, which is dynamically updated. The `baseRate` increases with each redemption, and decays according to time passed since the last fee event - i.e. the last redemption or issuance of LUSD.

The fee formulae are provisional, and subject to change depending on the results of economic modelling.

The current fee schedule:

Upon each redemption:
- `baseRate` is decayed based on time passed since the last fee event
- `baseRate` is incremented by an amount proportional to the fraction of the total LUSD supply that was redeemed
- The redemption fee is given by `baseRate * ETHdrawn`

Upon each debt issuance:
- `baseRate` is decayed based on time passed since the last fee event
- The issuance fee is given by `baseRate * newDebtIssued`

### Intuition behind fees

The larger the redemption volume, the greater the fee percentage.

The longer the time delay since the last operation, the more the `baseRate` decreases.

The intent is to throttle large redemptions with higher fees, and to throttle borrowing directly after large redemption volumes. The `baseRate` decay over time ensures that the fee for both borrowers and redeemers will “cool down”, while redemptions volumes are low.

### Fee decay Implementation

Time is measured in units of minutes. The `baseRate` decay is based on `block.timestamp - lastFeeOpTime`. If less than a minute has passed since the last fee event, then `lastFeeOpTime` is not updated. This prevents “base rate griefing”: i.e. it prevents an attacker stopping the `baseRate` from decaying by making a series of redemptions or issuing LUSD with time intervals of < 1 minute.

The decay parameter is tuned such that the fee changes by a factor of 0.99 per hour, i.e. it loses 1% of its current value per hour. At that rate, after one week, the baseRate decays to 18% of its prior value. The exact decay parameter is subject to change, and will be fine-tuned via economic modelling.

### Staking LQTY and earning fees

LQTY holders may `stake` and `unstake` their LQTY in the `LQTYStaking.sol` contract. 

When a fee event occurs, the fee in LUSD or ETH is sent to the staking contract, and a reward-per-unit-staked sum (`F_ETH`, or `F_LUSD`) is incremented. A LQTY stake earns a share of the fee equal to its share of the total LQTY staked, at the instant the fee occurred.

This staking formula and implementation follows the basic [“Batog” pull-based reward distribution](http://batog.info/papers/scalable-reward-distribution.pdf).


## Redistributions and Corrected Stakes

When a liquidation occurs and the Stability Pool is empty or smaller than the liquidated debt, the redistribution mechanism should distribute the remaining collateral and debt of the liquidated trove, to all active troves in the system, in proportion to their collateral.

For two troves A and B with collateral `A.coll > B.coll`, trove A should earn a bigger share of the liquidated collateral and debt.

In Liquity it is important that all active troves remain ordered by their ICR. We have proven that redistribution of the liquidated debt and collateral proportional to active troves’ collateral, preserves the ordering of active troves by ICR, as liquidations occur over time.  Please see the [proofs section](https://github.com/liquity/dev/tree/main/packages/contracts/mathProofs).

However, when it comes to implementation, Ethereum gas costs make it too expensive to loop over all troves and write new data to storage for each one. When a trove receives redistribution rewards, the system does not update the trove's collateral and debt properties - instead, the trove’s rewards remain "pending" until the borrower's next operation.

These “pending rewards” can not be accounted for in future reward calculations in a scalable way.

However: the ICR of a trove is always calculated as the ratio of its total collateral to its total debt. So, a trove’s ICR calculation **does** include all its previous accumulated rewards.

**This causes a problem: redistributions proportional to initial collateral can break trove ordering.**

Consider the case where new trove is created after all active troves have received a redistribution from a liquidation. This “fresh” trove has then experienced fewer rewards than the older troves, and thus, it receives a disproportionate share of subsequent rewards, relative to its total collateral.

The fresh trove would earns rewards based on its **entire** collateral, whereas old troves would earn rewards based only on **some portion** of their collateral - since a part of their collateral is pending, and not included in the trove’s `coll` property.

This can break the ordering of troves by ICR - see the [proofs section](https://github.com/liquity/dev/tree/main/packages/contracts/mathProofs).

### Corrected Stake Solution

We use a corrected stake to account for this discrepancy, and ensure that newer troves earn the same liquidation rewards per unit of total collateral, as do older troves with pending rewards. Thus the corrected stake ensures the sorted list remains ordered by ICR, as liquidation events occur over time.

When a trove is opened, its stake is calculated based on its collateral, and snapshots of the entire system collateral and debt which were taken immediately after the last liquidation.

A trove’s stake is given by:

```
stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot)
```

It then earns redistribution rewards based on this corrected stake. A newly opened trove’s stake will be less than its raw collateral, if the system contains active troves with pending redistribution rewards when it was made.

Whenever a borrower adjusts their trove’s collateral, their pending rewards are applied, and a fresh corrected stake is computed.

To convince yourself this corrected stake preserves ordering of active troves by ICR, please see the [proofs section](https://github.com/liquity/dev/tree/main/packages/contracts/mathProofs).

## Math Proofs

The Liquity implementation relies on some important system properties and mathematical derivations.

In particular, we have:

- Proofs that trove ordering is maintained throughout a series of liquidations and new loan issuances
- A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.

PDFs of these can be found in https://github.com/liquity/dev/tree/master/packages/contracts/mathProofs

## Definitions

_**Trove:**_ a collateralized debt position, bound to a single Ethereum address. Also referred to as a “CDP” in similar protocols.

_**LUSD**_:  The stablecoin that may be issued from a user's collateralized debt position and freely transferred/traded to any Ethereum address. Intended to maintain parity with the US dollar, and can always be redeemed directly with the system: 1 LUSD is always exchangeable for $1 USD worth of ETH.

_**Active trove:**_ an Ethereum address owns an “active trove” if there is a node in the `SortedTroves` list with ID equal to the address, and non-zero collateral is recorded on the trove struct for that address.

_**Closed trove:**_ a trove that was once active, but now has zero debt and zero collateral recorded on its struct, and there is no node in the `SortedTroves` list with ID equal to the owning address.

_**Active collateral:**_ the amount of ETH collateral recorded on a trove’s struct

_**Active debt:**_ the amount of LUSD debt recorded on a trove’s struct

_**Entire collateral:**_ the sum of a trove’s active collateral plus its pending collateral rewards accumulated from distributions

_**Entire debt:**_ the sum of a trove’s active debt plus its pending debt rewards accumulated from distributions

_**Individual collateral ratio (ICR):**_ a trove's ICR is the ratio of the dollar value of its entire collateral at the current ETH:USD price, to its entire debt

_**Total active collateral:**_ the sum of active collateral over all troves. Equal to the ETH in the ActivePool.

_**Total active debt:**_ the sum of active debt over all troves. Equal to the LUSD in the ActivePool.

_**Total defaulted collateral:**_ the total ETH collateral in the DefaultPool

_**Total defaulted debt:**_ the total LUSD debt in the DefaultPool

_**Entire system collateral:**_ the sum of the collateral in the ActivePool and DefaultPool

_**Entire system debt:**_ the sum of the debt in the ActivePool and DefaultPool

_**Total collateral ratio (TCR):**_ the ratio of the dollar value of the entire system collateral at the current ETH:USD price, to the entire system debt

_**Critical collateral ratio (CCR):**_ 150%. When the TCR is below the CCR, the system enters Recovery Mode.

_**Borrower:**_ an externally owned account or contract that locks collateral in a trove and issues LUSD tokens to their own address. They “borrow” LUSD tokens against their ETH collateral.

_**Depositor:**_ an externally owned account or contract that has assigned LUSD tokens to the Stability Pool, in order to earn returns from liquidations, and receive LQTY token issuance.

_**Redemption:**_ the act of swapping LUSD tokens with the system, in return for an equivalent value of ETH. Any account with a LUSD token balance may redeem them, whether or not they are a borrower.

When LUSD is redeemed for ETH, the ETH is always withdrawn from the lowest collateral troves, in ascending order of their collateral ratio. A redeemer can not selectively target troves with which to swap LUSD for ETH.

_**Repayment:**_ when a borrower sends LUSD tokens to their own trove, reducing their debt, and increasing their collateral ratio.

_**Retrieval:**_ when a borrower with an active trove withdraws some or all of their ETH collateral from their own trove, either reducing their collateral ratio, or closing their trove (if they have zero debt and withdraw all their ETH)

_**Liquidation:**_ the act of force-closing an undercollateralized trove and redistributing its collateral and debt. When the Stability Pool is sufficiently large, the liquidated debt is offset with the Stability Pool, and the ETH distributed to depositors. If the liquidated debt can not be offset with the Pool, the system redistributes the liquidated collateral and debt directly to the active troves with >110% collateral ratio.

Liquidation functionality is permissionless and publically available - anyone may liquidate an undercollateralized trove, or batch liquidate troves in ascending order of collateral ratio.

_**Collateral Surplus**_: The difference between the dollar value of a trove's ETH collateral, and the dollar value of its LUSD debt. In a full liquidation, this is the net gain earned by the recipients of the liquidation.

_**Offset:**_ cancellation of liquidated debt with LUSD in the Stability Pool, and assignment of liquidated collateral to Stability Pool depositors, in proportion to their deposit.

_**Redistribution:**_ assignment of liquidated debt and collateral directly to active troves, in proportion to their collateral.

_**Pure offset:**_  when a trove's debt is entirely cancelled with LUSD in the Stability Pool, and all of it's liquidated ETH collateral is assigned to Stability Pool depositors.

_**Mixed offset and redistribution:**_  When the Stability Pool LUSD only covers a fraction of the liquidated trove's debt.  This fraction of debt is cancelled with LUSD in the Stability Pool, and an equal fraction of the trove's collateral is assigned to depositors. The remaining collateral & debt is redistributed directly to active troves.

_**Gas compensation:**_ A refund, in LUSD and ETH, automatically paid to the caller of a liquidation function, intended to at least cover the gas cost of the transaction. Designed to ensure that liquidators are not dissuaded by potentially high gas costs.

## Development

The Liquity monorepo is based on Yarn's [workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) feature. You might be able to install some of the packages individually with npm, but to make all interdependent packages see each other, you'll need to use Yarn.

In addition, some package scripts require Docker to be installed (Docker Desktop on Windows and Mac, Docker Engine on Linux).

### Prerequisites

You'll need to install the following:

- [Git](https://help.github.com/en/github/getting-started-with-github/set-up-git) (of course)
- [Node v12.x](https://nodejs.org/dist/latest-v12.x/)
- [Docker](https://docs.docker.com/get-docker/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install)

#### Making node-gyp work

Liquity indirectly depends on some packages with native addons. To make sure these can be built, you'll have to take some additional steps. Refer to the subsection of [Installation](https://github.com/nodejs/node-gyp#installation) in node-gyp's README that corresponds to your operating system.

Note: you can skip the manual installation of node-gyp itself (`npm install -g node-gyp`), but you will need to install its prerequisites to make sure Liquity can be installed.

### Clone & Install

```
git clone https://github.com/liquity/dev.git liquity
cd liquity
yarn
```

### Top-level scripts

There are a number of scripts in the top-level package.json file to ease development, which you can run with yarn.

#### Run all tests

```
yarn test
```

#### Deploy contracts to a testnet

E.g.:

```
yarn deploy --network ropsten
```

Supported networks are currently: ropsten, kovan, rinkeby, goerli. The above command will deploy into the default channel (the one that's used by the public dev-frontend). To deploy into the internal channel instead:

```
yarn deploy --network ropsten --channel internal
```

You can optionally specify an explicit gas price too:

```
yarn deploy --network ropsten --gas-price 20
```

After a successful deployment, the addresses of the newly deployed contracts will be written to a version-controlled JSON file under `packages/lib/deployments/default`.

To publish a new deployment, you must execute the above command for all of the following combinations:

| Network | Channel  |
| ------- | -------- |
| ropsten | default  |
| ropsten | internal |
| kovan   | default  |
| rinkeby | default  |
| goerli  | default  |

At some point in the future, we will make this process automatic. Once you're done deploying to all the networks, execute the following command:

```
yarn save-live-version
```

This copies the contract artifacts to a version controlled area (`packages/lib/live`) then checks that you really did deploy to all the networks. Next you need to commit and push all changed files. The repo's GitHub workflow will then build a new Docker image of the frontend interfacing with the new addresses.

#### Start a local blockchain and deploy the contracts

```
yarn start-dev-chain
```

Starts an openethereum node in a Docker container, running the [private development chain](https://openethereum.github.io/wiki/Private-development-chain), then deploys the contracts to this chain.

You may want to use this before starting the dev-frontend in development mode. To use the newly deployed contracts, switch MetaMask to the built-in "Localhost 8545" network.

> Q: How can I get Ether on the local blockchain?  
> A: Import this private key into MetaMask:  
> `0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7`  
> This account has all the Ether you'll ever need.

Once you no longer need the local node, stop it with:

```
yarn stop-dev-chain
```

#### Start dev-frontend in development mode

```
yarn start-dev-frontend
```

This will start dev-frontend in development mode on http://localhost:3000. The app will automatically be reloaded if you change a source file under `packages/dev-frontend`.

If you make changes to a different package under `packages`, it is recommended to rebuild the entire project with `yarn prepare` in the root directory of the repo. This makes sure that a change in one package doesn't break another.

To stop the dev-frontend running in this mode, bring up the terminal in which you've started the command and press Ctrl+C.

#### Start dev-frontend in demo mode

This will automatically start the local blockchain, so you need to make sure that's not already running before you run the following command.

```
yarn start-demo
```

This spawns a modified version of dev-frontend that ignores MetaMask, and directly uses the local blockchain node. Every time the page is reloaded (at http://localhost:3000), a new random account is created with a balance of 100 ETH. Additionally, transactions are automatically signed, so you no longer need to accept wallet confirmations. This lets you play around with Liquity more freely.

When you no longer need the demo mode, press Ctrl+C in the terminal then run:

```
yarn stop-demo
```

#### Build dev-frontend for production

In a freshly cloned & installed monorepo, or if you have only modified code inside the dev-frontend package:

```
yarn build
```

If you have changed something in one or more packages apart from dev-frontend, it's best to use:

```
yarn rebuild
```

This combines the top-level `prepare` and `build` scripts.
