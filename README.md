# Liquity System Summary

![Tests](https://github.com/liquity/dev/workflows/CI/badge.svg) [![Frontend status](https://img.shields.io/uptimerobot/status/m785036778-7edf816c69dafd2d19c45491?label=Frontend&logo=nginx&logoColor=white)](https://devui.liquity.org/internal) ![uptime](https://img.shields.io/uptimerobot/ratio/7/m785036778-7edf816c69dafd2d19c45491) [![Discord](https://img.shields.io/discord/700620821198143498?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/2up5U32) [![Docker Pulls](https://img.shields.io/docker/pulls/liquity/dev-frontend?label=dev-frontend%20pulls&logo=docker&logoColor=white)](https://hub.docker.com/r/liquity/dev-frontend)

- [Liquity Overview](#liquity-overview)
  - [Liquidation and the Stability Pool](#liquidation-and-the-stability-pool)
  - [Rewards From Liquidations](#rewards-from-liquidations)
  - [Recovery Mode](#recovery-mode)
  - [CLV Token Redemption](#clv-token-redemption)
  - [Project Structure](#project-structure)
    - [Directories](#directories)
    - [Branches](#branches)
  - [System Architecture](#system-architecture)
    - [Core Smart Contracts](#core-smart-contracts)
    - [Data and Value Silo Contracts](#data-and-value-silo-contracts)
    - [Contract Interfaces](#contract-interfaces)
    - [PriceFeed and Oracle](#pricefeed-and-oracle)
    - [Keeping a sorted list of CDPs ordered by ICR](#keeping-a-sorted-list-of-cdps-ordered-by-icr)
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
  - [Supplying Hints to CDP operations](#supplying-hints-to-cdp-operations)
  - [Gas Compensation](#gas-compensation)
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

Liquity is a collateralized stablecoin platform. Users can lock up ether, and issue stablecoin tokens (CLV) to their own Ethereum address, and subsequently transfer those tokens to any other Ethereum address.

The stablecoin tokens are economically guaranteed to maintain value of 1 CLV = \$1 USD, due to two system properties:

1. The system will always be over-collateralized - the dollar value of the locked ether exceeds the dollar value of the issued stablecoins

2. The stablecoins are fully redeemable - users can always swap $x worth of CLV for $x worth of ETH, directly with the system.

After opening a CDP with some ether, they may issue tokens such that the collateral ratio of their CDP remains above 110%. A user with $1000 worth of ETH in a CDP can issue up to $909.09 worth of CLV.

Tokens are freely exchangeable - anyone with an Ethereum address can send or receive CLV tokens, whether they have an open CDP or not.

The Liquity system regularly updates the ETH:USD price via a decentralized data feed. When a CDP falls below a minimum collateral ratio (MCR) of 110%, it is considered under-collateralized, and is vulnerable to liquidation.

## Liquidation and the Stability Pool

Liquity redistributes the collateral and debt from under-collateralized loans. It distributes primarily to CLV holders who have added tokens to the Stability Pool.

Any user may deposit CLV tokens to the Stability Pool. This allows them to earn “rewards” over time, from liquidated CDPs. When a liquidation occurs, the liquidated debt is cancelled with CLV in the Pool, and the liquidated Ether is proportionally distributed to depositors.

Stability Pool depositors can expect to earn net gains from liquidations, as in most cases, the value of the liquidated Ether will be greater than the value of the cancelled debt (since a liquidated CDP will likely have an ICR just slightly below 110%).

Anyone may call the public `liquidateCDPs()` function, which will check for under-collateralized loans, and liquidate them.

Liquity redistributes liquidations in two ways: firstly, it tries to cancel as much debt as possible with the tokens in the Stability pool, and distributes the liquidated collateral between the Stability Pool depositors.

Secondly, if the CLV in the Pool is not sufficient to cancel with the liquidated debt, the system cancels as much as possible, and then distributes the remaining liquidated collateral and debt across all active CDPs.

## Rewards From Liquidations

Stability Pool depositors earn rewards in Ether over time, as liquidated debt is cancelled with their deposit. When they withdraw all or part of their deposited tokens, or top up their deposit, they system sends them their accumulated ETH gains.

Similarly, a CDP’s accumulated rewards from liquidations are automatically applied to the CDP when the owner performs any operation - e.g. adding/withdrawing collateral, or issuing/repaying CLV.

## CLV Token Redemption

Any CLV holder (whether or not they have an active CDP) may redeem their CLV directly with the system. Their CLV is exchanged for ETH, at face value: redeeming x CLV tokens returns \$x worth of ETH.

When CLV is redeemed for ETH, the system cancels the CLV with debt from troves, and the ETH is drawn from their collateral.

In order to fulfill the redemption request, troves are redeemed from in ascending order of their collateral ratio.

Economically, this redemption mechanism creates a hard price floor for CLV, ensuring that the market price stays at or near to \$1 USD.

## Recovery Mode

Recovery Mode kicks in when the total collateral ratio (TCR) of the system falls below 150%.

During Recovery Mode, liquidation conditions are relaxed, and the system blocks issuance of new CLV, and withdrawal of collateral. Recovery Mode is structured to incentivize borrowers to behave in ways that promptly raise the TCR back above 150%.

Recovery Mode is designed to encourage collateral top-ups, and also itself acts as a self-negating deterrent: the possibility of it occurring actually guides the system away from ever reaching it.

## Project Structure

### Directories

- `packages/dev-frontend/` - Liquity Developer UI: a fully functional React app used for interfacing with the smart contracts during development
- `packages/frontend/` - The front-end React app for the user-facing web interface
- `packages/lib/` - A layer between the front-end and smart contracts that handles the intermediate logic and low-level transactions
- `packages/contracts/` The backend development folder, contains the Buidler project, contracts and tests
- `packages/contracts/contracts/` -The core back end smart contracts written in Solidity
- `packages/contracts/test/` - JS test suite for the system. Tests run in Mocha/Chai
- `packages/contracts/gasTest/` - Non-assertive tests that return gas costs for Liquity operations under various scenarios
- `packages/contracts/migrations/` - contains Buidler script for deploying the smart contracts to the blockchain
- `packages/contracts/utils/` - external Buidler and node scripts - deployment helpers, gas calculators, etc
- `packages/contracts/mathProofs/` - core mathematical proofs of Liquity properties, and a derivation of the scalable Stability Pool staking formula

Backend development is done in the Buidler framework, and allows Liquity to be deployed on the Buidler EVM network for fast compilation and test execution.

### Branches

As of 21/08/2020, the current working branch is `main`.  

`master` is somewhat out of date, as our CI pipeline automatically redeploys contracts to testnet from master branch, and we want users to have a chance to engage with the existing deployments.

A code freeze for the simulation project will be located on a branch named `simulation`.

Other branches contain functionality that has either been shelved (`size-range-lists`, `overstay`) or integrated into our core system (`security-tweaks`).

## System Architecture

The core Liquity system consists of several smart contracts, which are deployable to the Ethereum blockchain.

All application logic and data is contained in these contracts - there is no need for a separate database or back end logic running on a web server. In effect, the Ethereum network is itself the Liquity back end. As such, all balances and contract data are public.

The system has no admin key or human governance. Once deployed, it is fully automated, decentralized and no user holds any special privileges in or control over the system.

The three main contracts - `BorrowerOperations.sol`, `CDPManager.sol` and `PoolManager.sol` - hold the user-facing public functions, and contain most of the internal system logic. Together they control trove state updates and movements of ether and tokens around the system.

### Core Smart Contracts

`BorrowerOperations.sol` - contains the basic operations by which borrowers interact with their CDP: loan creation, ETH top-up / withdrawal, stablecoin issuance and repayment. BorrowerOperations functions call in to CDPManager, telling it to update trove state, where necessary. BorrowerOperations functions also call in to PoolManager, telling it to move Ether and/or tokens between Pools, where necessary.

`CDPManager.sol` - contains functionality for liquidations and redemptions. Also contains the state of each trove - i.e. a record of the trove’s collateral and debt. The CDPManager does not hold value (i.e. ether / tokens). CDPManager functions call in to PooManager to tell it to move ether/tokens between Pools, where necessary.

`LiquityBase.sol` - Both CDPManager and BorrowerOperations inherit from the parent contract LiquityBase, which contains global constants and some common functions.

`PoolManager.sol` - contains functionality for Stability Pool operations: making deposits, and withdrawing compounded deposits and accumulated ETH rewards. It also directs the transfers of ether and tokens between Pools.

`CLVToken.sol` - the stablecoin token contract, which implements the ERC20 fungible token standard. The contract mints, burns and transfers CLV tokens.

`SortedCDPs.sol` - a doubly linked list that stores addresses of CDP owners, sorted by their individual collateral ratio (ICR). It inserts and re-inserts CDPs at the correct position, based on their ICR.

`PriceFeed.sol` - Contains functionality for obtaining the current ETH:USD price, which the system uses for calculating collateral ratios. Currently, the price is a state variable that can be manually set by the admin. The PriceFeed contract will eventually store no price data, and when called from within other Liquity contracts, will automatically pull the current and decentralized ETH:USD price data from the Chainlink contract.

`HintHelpers.sol` - Helper contract, containing the read-only functionality for calculation of accurate hints to be supplied to borrower operations and redemptions.

### Data and Value Silo Contracts

These contracts hold ether and/or tokens for their respective parts of the system, and contain minimal logic.

`CLVTokenData.sol` - contains the record of stablecoin balances for all addresses.

`StabilityPool.sol` - holds an ERC20 balance of all stablecoin tokens deposits, and the total ether balance of all the ETH earned by depositors.

`ActivePool.sol` - holds the total ether balance and records the total stablecoin debt of the active loans.

`DefaultPool.sol` - holds the total ether balance and records the total stablecoin debt of the liquidated loans that are pending redistribution to active troves. If a trove has pending ether/debt “rewards” in the DefaultPool, then they will be applied to the trove when it next undergoes a borrower operation, a redemption, or a liquidation.

### Contract Interfaces

`ICDPManager.sol`, `IPool.sol` etc. These provide specification for a contract’s functions, without implementation. They are similar to interfaces in Java or C#.

### PriceFeed and Oracle

Liquity functions that require the most current ETH:USD price data fetch the price dynamically, as needed, via the core `PriceFeed.sol` contract.

Currently, provisional plans are to use the Chainlink ETH:USD reference contract for the price data source, however, other options are under consideration.

The current PriceFeed contract is a placeholder and contains a manual price setter, `setPrice()`. Price can be manually set, and `getPrice()` returns the latest stored price. In the final deployed version, no price will be stored or set, and `getPrice()` will fetch the latest ETH:USD price from the Chainlink reference contract.

### Keeping a sorted list of CDPs ordered by ICR

Liquity relies on a particular data structure: a sorted doubly-linked list of troves that remains ordered by individual collateral ratio (ICR).

This ordered list is critical for gas-efficient redemption sequences and for the `liquidateCDPs` sequence, both of which target troves in ascending order of ICR.

The sorted doubly-linked list is found in `SortedCDPs.sol`. 

Nodes map to active troves in the system - the ID property is the address of a trove owner. The list accepts positional hints for efficient O(1) insertion - please see the hints section for more details.

ICRs are computed dynamically at runtime, and not stored on the node. This is because ICRs of active troves change dynamically, when:

- The ETH:USD price varies, altering the USD of the collateral of every trove
- A liquidation that redistributes collateral and debt to active troves occurs

The list relies on the fact that a collateral and debt redistribution due to a liquidation preserves the ordering of all active troves (though it does decrease the ICR of each active trove above the MCR).

The fact that ordering is maintained as redistributions occur, is not immediately obvious: please see the [mathematical proof](https://github.com/liquity/dev/tree/master/packages/contracts/mathProofs) which shows that this holds in Liquity.

A node inserted based on current ICR will maintain the correct position, relative to it's peers, as liquidation rewards accumulate, as long as its raw collateral and debt have not changed.

Nodes also remain sorted as the ETH:USD price varies, since price fluctuations change the collateral value of each trove by the same proportion.

Thus, nodes need only be re-inserted to the sorted list upon a CDP operation - when the owner adds or removes collateral or debt to their position.

### Flow of Ether in Liquity

Ether in the system lives in three Pools: the ActivePool, the DefaultPool and the StabilityPool. When an operation is made, ether is transferred in one of three ways:

- From a user to a Pool
- From a Pool to a user
- From one Pool to another Pool

Ether is recorded on an _individual_ level, but stored in _aggregate_ in a Pool. An active trove with collateral and debt has a struct in the CDPManager that stores its ether collateral value in a uint, but its actual ether is in the balance of the ActivePool contract.

Likewise, a StabilityPool depositor who has earned some ETH gain from their deposit will have a computed ETH gain based on a variable in the PoolManager. But their actual withdrawable ether is in the balance of the StabilityPool contract.

**Borrower Operations**

| Function                    | ETH quantity       | Path                                |
| --------------------------- | ------------------ | ----------------------------------- |
| openLoan                    | msg.value          | msg.sender->PoolManager->ActivePool |
| addColl                     | msg.value          | msg.sender->PoolManager->ActivePool |
| withdrawColl                | \_amount parameter | ActivePool->msg.sender              |
| adjustLoan: adding ETH      | msg.value          | msg.sender->PoolManager->ActivePool |
| adjustLoan: withdrawing ETH | \_amount parameter | ActivePool->msg.sender              |
| closeLoan                   | \_amount parameter | ActivePool->msg.sender              |

**CDP Manager**

| Function                   | ETH quantity                   | Path                      |
| -------------------------- | ------------------------------ | ------------------------- |
| liquidate (offset)         | collateral to be offset        | ActivePool->StabilityPool |
| liquidate (redistribution) | collateral to be redistributed | ActivePool->DefaultPool   |
| redeemCollateral           | collateral to be swapped       | ActivePool->msg.sender    |

**Pool Manager**

| Function            | ETH quantity                 | Path                                                                        |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| provideToSP         | depositor's current ETH gain | StabilityPool -> msg.sender                                                 |
| withdrawFromSP      | depositor's current ETH gain | StabilityPool -> msg.sender                                                 |
| withdrawFromSPtoCDP | depositor's current ETH gain | StabilityPool -> PoolManager ->BorrowerOperations ->PoolManager->ActivePool |

### Flow of ERC20 tokens in Liquity

When a user issues debt from their trove, CLV tokens are minted to their own address, and a debt is recorded on the trove. Conversely, when they repay their trove’s CLV debt, CLV is burned from their address, and the debt on their trove is reduced.

Redemptions burn CLV from the redeemer’s balance, and reduce the debt of the trove redeemed against.

Liquidations that involve a Stability Pool offset burn tokens from the Stability Pool’s balance, and reduced the CLV debt of the liquidated trove.

The only time CLV is transferred to/from a Liquity contract, is when a user deposits CLV to, or withdraws CLV from, the StabilityPool.

**Borrower Operations**

| Function                    | ERC20 Operation                       |
| --------------------------- | ------------------------------------- |
| openLoan                    | ERC20.\_mint(msg.sender, \_CLVAmount) |
| withdrawCLV                 | ERC20.\_mint(msg.sender, \_CLVAmount) |
| repayCLV                    | ERC20.\_burn(msg.sender, \_CLVAmount) |
| adjustLoan: withdrawing CLV | ERC20.\_mint(msg.sender, \_CLVAmount) |
| adjustLoan: repaying CLV    | ERC20.\_burn(msg.sender, \_CLVAmount) |
| closeLoan                   | ERC20.\_burn(msg.sender, \_CLVAmount) |

**CDP Manager**

| Function           | ERC20 Operation                                     |
| ------------------ | --------------------------------------------------- |
| liquidate (offset) | ERC20.\_burn(stabilityPoolAddress, \_debtToOffset); |
| redeemCollateral   | ERC20.\_burn(msg.sender, \_CLV)                     |

**Pool Manager**

| Function       | ERC20 Operation                                              |
| -------------- | ------------------------------------------------------------ |
| provideToSP    | ERC20.\_transfer(msg.sender, stabilityPoolAddress, \_amount) |
| withdrawFromSP | ERC20.\_transfer(stabilityPoolAddress, msg.sender, \_amount) |

## Expected User Behaviors

Generally, borrowers call functions that trigger CDP operations on their own CDP. Stability Pool users (who may or may not also be borrowers) call functions that trigger Stability Pool operations, such as depositing or withdrawing tokens to/from the Stability Pool.

Anyone may call the public liquidation functions, and attempt to liquidate one or several CDPs.

CLV token holders may also redeem their tokens, and swap an amount of tokens 1-for-1 in value with ether.

## Contract Ownership and Function Permissions

All the core smart contracts inherit from the OpenZeppelin `Ownable.sol` contract template. As such all contracts have a single owning address, which is the deploying address.

Several public and external functions have modifiers such as `onlyCDPManager`, `onlyPoolManager`, etc - ensuring they can only be called by the respective permitted contract.

## Deployment to a Development Blockchain

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
|                   | uint256  | CLVDebt                  | Total outstanding CLV Debt in active troves                                       | integer                  | attoCLV (C)                |
| **DefaultPool**   | uint256  | ETH                      | Total liquidated ETH, pending reward                                              | integer                  | wei (E)                    |
|                   | uint256  | CLVDebt                  | Total closed CLV debt, pending reward                                             | integer                  | attoCLV (C)                |
| **StabilityPool** | uint256  | ETH                      | Total accumulated ETH Gains from StabilityPool                                    | integer                  | wei (E)                    |
|                   | uint256  | totalCLVDeposits         | Total current CLV deposits                                                        | integer                  | attoCLV (C)                |
|                   |          |                          |                                                                                   |                          |                            |
| **PriceFeed**     | uint256  | price                    | The last recorded price of 1 Ether, in USD                                        | 18 digit decimal         | dollars per ether (\$ / E) |
|                   |          |                          |                                                                                   |                          |                            |
| **CDPManager**    | constant | MCR                      | Min collateral ratio.                                                             | 18 digit decimal         | none ( $ / $)              |
|                   | constant | CCR                      | Critical collateral ratio.                                                        | 18 digit decimal         | none ( $ / $)              |
|                   | uint256  | totalStakes              | sum of all trove stakes                                                           | integer                  | wei (E)                    |
|                   | uint256  | totalStakesSnapshot      | snapshot of totalStakes at last liquidation                                       | integer                  | wei (E)                    |
|                   | uint256  | totalCollateralSnapshot  | snapshot of totalCollateral at last liquidation                                   | integer                  | wei (E)                    |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | L_ETH                    | accumulated ETH reward-per-unit-staked for troves                                 | 18 digit decimal         | none (E / E)               |
|                   | uint256  | L_CLVDebt                | accumulated CLV Debt reward-per-unit-staked for troves                            | 18 digit decimal         | CLV Debt per ether (C / E) |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | lastETHError_Redist.     | error tracker for the ETH error correction in \_redistributeDebtAndColl()         | 18 digit decimal \* 1e18 | Ether (E)                  |
|                   | uint256  | lastCLVDebtError_Redist. | error tracker for the CLVDebt error correction in \_redistributeDebtAndColl()     | 18 digit decimal \* 1e18 | CLV (C)                    |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | CDP[user].debt           | user's trove debt                                                                 | integer                  | attoCLV(C)                 |
|                   | uint256  | CDP[user].coll           | user's trove collateral                                                           | integer                  | wei (E)                    |
|                   | uint256  | CDP[user].stake          | user's trove stake                                                                | integer                  | wei (E)                    |
|                   | uint256  | CDP[user].arrayIndex     | user's index in the trove owners array                                            | integer                  | none                       |
|                   |          |                          |                                                                                   |                          |                            |
|                   |          |                          |                                                                                   |                          |                            |
| **PoolManager**   | uint256  | epochToScaleToSum[S]     | Sum term for the accumulated ETH gain per-unit-deposited                          | 18 digit decimal \* 1e18 | Ether per CLV (E / C)      |
|                   | uint256  | P                        | Product term for the compounded-deposit-per-unit-deposited                        | 18 digit decimal         | none (C / C)               |
|                   | uint256  | currentScale             | The number of times the scale of P has shifted by 1e-18                           | integer                  | none                       |
|                   | uint256  | currentEpoch             | The number of times the Stability Pool has been fully emptied by a liquidation    | integer                  | none                       |
|                   |          |                          |                                                                                   |                          |                            |
|                   | uint256  | lastETHError_Offset      | error tracker for the ETH error correction in \_computeRewardsPerUnitStaked()     | 18 digit decimal \* 1e18 | Ether (E)                  |
|                   | uint256  | lastCLVLossError_Offset  | error tracker for the CLVLoss error correction in \_computeRewardsPerUnitStaked() | 18 digit decimal \* 1e18 | CLV (C)                    |
|                   |          |                          |                                                                                   |                          |                            |
| **BorrowerOps**   | constant | MCR                      | Min collateral ratio.                                                             | 18 digit decimal         | none ( $ / $)              |
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

All data structures with the ‘public’ visibility specifier are ‘gettable’, with getters automatically generated by the compiler. Simply call `CDPManager::MCR()` to get the MCR, etc.

## Public User-Facing Functions

### Borrower CDP Operations - _BorrowerOperations.sol_

`openLoan(uint _CLVAmount)`: payable function that creates a CDP for the caller with the requested debt, and the ether received as collateral. Successful execution is conditional - the collateral must exceed \$20 in value, and the resulting collateral ratio must exceed the minimum (110% in normal circumstances).

`addColl(address _user, address _hint)`: payable function that adds the received ether to the given user’s active CDP. Allows any user to add ether to any other user’s CDP. The initial ether must exceed \$20 USD in value.

`withdrawColl(uint _amount, address _hint)`: withdraws `_amount` of collateral from the caller’s CDP. Executes only if the user has an active CDP, and the withdrawal would not pull the user’s CDP below the minimum collateral ratio. If it is a partial withdrawal, it must not leave a remaining collateral with value below \$20 USD.

`withdrawCLV(uint _amount, address_hint)`: issues `_amount` of CLV from the caller’s CDP to the caller. Executes only if the resultant collateral ratio would remain above the minimum.

`repayCLV(uint _amount, uint _hint)`: repay `_amount` of CLV to the caller’s CDP.

`adjustLoan(uint _collWithdrawal, int _debtChange, address _hint)`: enables a borrower to simultaneously change both their collateral and debt, subject to all the restrictions that apply to individual increases/decreases of each quantity.

`closeLoan()`: allows a borrower to repay all debt, withdraw all their collateral, and close their loan.

### CDPManager Functions - _CDPManager.sol_

`liquidate(address _user)`: callable by anyone, attempts to liquidate the CDP of `_user`. Executes successfully if `_user`’s CDP meets the conditions for liquidation (e.g. in Normal Mode, it liquidates if the CDP's ICR < the system MCR)

`liquidateCDPs(uint n)`: callable by anyone, checks for under-collateralised CDPs below MCR and liquidates up to `n`, starting from the CDP with the lowest collateral ratio; subject to gas constraints and the actual number of under-collateralized CDPs.

`batchLiquidateTroves( address[] calldata troveList)`: callable by anyone, accepts a custom list of troves/CDPs addresses as an argument. Steps through the provided list and attempts to liquidate every trove/CDP, until it reaches the end or it runs out of gas. A CDP is liquidated only if it meets the conditions for liquidation.

`redeemCollateral(uint _CLVamount, address _firstRedemptionHint, address _partialRedemptionHint, uint _partialRedemptionHintICR)`: redeems `_CLVamount` of stablecoins for ether from the system. Decreases the caller’s CLV balance, and sends them the corresponding amount of ETH. Executes successfully if the caller has sufficient CLV to redeem.

`getCurrentICR(address _user, uint _price)`: computes the user’s individual collateral ratio (ICR) based on their total collateral and total CLV debt. Returns 2^256 -1 if they have 0 debt.

`getCDPOwnersCount()`: get the number of active CDPs in the system

`getPendingETHReward(address _user)`: get the pending ETH reward from liquidation redistribution events, for the given CDP.

`getPendingCLVDebtReward(address _user)`: get the pending CLV debt "reward" (i.e. the amount of extra debt assigned to the CDP) from liquidation redistribution events.

`getTCR()`: returns the total collateral ratio (TCR) of the system.  The TCR is based on the the entire system debt and collateral (including pending rewards).

`checkRecoveryMode()`: reveals whether or not the system is in Recovery Mode (i.e. whether the Total Collateral Ratio (TCR) is below the Critical Collateral Ratio (CCR))

### Hint Helper Functions - _HintHelpers.sol_

`getApproxHint(uint _CR, uint _numTrials)`: helper function, returns a positional hint for the sorted list. Used for transactions that must efficiently re-insert a CDP to the sorted list

`getRedemptionHints(uint _CLVamount, uint _price)`: helper function specifically for redemptions. Returns two hints - the first is positional, the second ensures transaction success.

### Stability Pool Functions - _PoolManager.sol_

`provideToSP(uint _amount)`: allows stablecoin holders to deposit `_amount` of CLV to the Stability Pool. If they already have tokens in the pool, it sends all accumulated ETH gains to their address. It tops up their CLV deposit by `_amount`, and reduces their CLV balance by `_amount`. This function automatically withdraws the user's entire accumulated ETH gain from the Stability Pool to their address.

`withdrawFromSP(uint _amount)`: allows a stablecoin holder to withdraw `_amount` of CLV from the Stability Pool, up to the value of their remaining Stability deposit. Sends all their accumulated ETH gains to their address, and increases their CLV balance by `_amount`. If the user makes a partial withdrawal, their deposit remainder will earn further rewards.

`withdrawFromSPtoCDP(address _user, address _hint)`: sends the user's entire accumulated ETH gain to the user's active CDP, and updates their Stability deposit with its accumulated loss from debt absorptions. If called by an externally owned account, the argument \_user must be the calling account.

`getTCR()`: returns the Total Collateral Ratio (TCR) of the system, based on the entire (active and defaulted) debt, and the entire (active and defaulted) collateral

`getCurrentETHGain(address _user)`: returns the accumulated ETH gain for a given Stability Pool depositor

`getCompoundedCLVDeposit(address _user)`: returns the remaining deposit amount for a given Stability Pool depositor

### Individual Pool Functions - _StabilityPool.sol_, _ActivePool.sol_, _DefaultPool.sol_

`getRawEtherBalance()`: returns the actual raw ether balance of the contract. Distinct from the ETH public variable, which returns the total recorded ETH deposits.

## Supplying Hints to CDP operations

CDPs in Liquity are recorded in a sorted doubly linked list, sorted by their ICR, from high to low.

All CDP operations that change the collateral ratio need to either insert or reinsert the CDP to the `SortedCDPs` list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, a ‘hint’ may be provided.

A hint is the address of a CDP with a position in the sorted list close to the correct insert position.

All CDP operations take a ‘hint’ argument. The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call.

The `CDPManager::getApproxHint()` function can be used to generate a useful hint, which can then be passed as an argument to the desired CDP operation or to `SortedCDPs::findInsertPosition()` to get an exact hint.

`getApproxHint()` takes two arguments: `CR`, and `numTrials`. The function randomly selects `numTrials` amount of CDPs, and returns the one with the closest position in the list to where a CDP with a collateral ratio of `CR` should be inserted. It can be shown mathematically that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst case O(sqrt(n)), if k >= 10.

**CDP operation without a hint**

1. User performs CDP operation in their browser
2. Call the CDP operation with `_hint = userAddress`

Gas cost will be worst case O(n), where n is the size of the `SortedCDPs` list.

**CDP operation with hint**

1. User performs CDP operation in their browser
2. The front end computes a new collateral ratio locally, based on the change in collateral and/or debt.
3. Call `CDPManager::getApproxHint()`, passing it the computed collateral ratio. Returns an address close to the correct insert position
4. Call `SortedCDPs::findInsertPosition(uint256 _ICR, address _prevId, address _nextId)`, passing it the hint via both `_prevId` and `_nextId` and the new collateral ratio via `_ICR`.
5. Pass the exact position as an argument to the CDP operation function call. (Note that the hint may become slightly inexact due to pending transactions that are processed first, though this is gracefully handled by the system.)

Gas cost of steps 2-4 will be free, and step 5 will be O(1).

Hints allow cheaper CDP operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to Infura, unless the front end operator is running a full Ethereum node.

Each BorrowerOperations function that reinserts a CDP takes a single hint, as does `PoolManager::withdrawFromSPtoCDP`.

### Hints for `redeemCollateral`

`CDPManager::redeemCollateral` requires two hints. The first hint provides an accurate reinsert position (as described above), and the second hint ensures the transaction succeeds.

All CDPs that are fully redeemed from in a redemption sequence are left with zero debt, and are reinserted at the top of the sortedCDPs list.

It’s likely that the last CDP in the redemption sequence would be partially redeemed from - i.e. only some of its debt cancelled with CLV. In this case, it should be reinserted somewhere between top and bottom of the list. The first hint passed to `redeemCollateral` gives the expected reinsert position.

However, if during off-chain hint computation a different transaction changes the state of a CDP that would otherwise be hit by the redemption sequence, then the off-chain hint computation could end up totally inaccurate. This could lead to the whole redemption sequence reverting due to out-of-gas error.

To mitigate this, a second hint is provided: the expected ICR of the final partially-redeemed-from CDP. The on-chain redemption function checks whether, after redemption, the ICR of this CDP would equal the ICR hint.

If not, the redemption sequence doesn’t perform the final partial redemption, and terminates early. This ensures that the transaction doesn’t revert, and most of the requested CLV redemption can be fulfilled.

## Gas compensation

In Liquity, we want to maximize liquidation throughput, and ensure that undercollateralized troves are liquidated promptly by “liquidators” - agents who also hold Stability Pool deposits, and who expect to profit from liquidations.

However, gas costs in Ethereum are substantial. If the gas costs of our public liquidation functions are too high, this may discourage liquidators from calling them, and leave the system holding too many undercollateralized troves for too long.

Our solution is to directly compensate liquidators for their gas costs, to incentivize prompt liquidations in both normal and extreme periods of high gas prices. Liquidators should be confident that they will at least break even by making liquidation transactions.

Gas compensation is paid in ETH. A liquidation transaction draws ETH from the trove(s) it liquidates, and sends the compensation ETH to the caller, and liquidates the remainder.

When a liquidation transaction liquidates multiple troves, each trove contributes ETH towards the total compensation for the transaction.

Gas compensation per liquidated trove is given by the formula:

Gas compensation = `max { $10 worth of ETH,  0.5% of trove’s collateral }`

The intentions behind this formula are:
- To ensure that smaller troves are liquidated promptly in normal times, at least
- To ensure that larger troves are liquidated promptly even in extreme high gas price periods. The larger the trove, the stronger the incentive to liquidate it.

### Virtual debt

Troves are assigned a virtual debt of 10 CLV. This is included in their individual collateral ratio (ICR) calculation: 

`ICR = $(collateral) / (actualDebt + virtualDebt) `

Where “$” represents the value in USD.

The purpose of the virtual debt is to cover the minimum gas compensation in normal times, and ensure that compensation can be paid to liquidators without impacting the returns for the Stability Pool depositors.

When a trove is liquidated, depositors earn the collateral surplus: i.e.  

`$(collateral - gasCompensation) - actualDebt.`

When the gas compensation is equal in value to the virtual debt, depositors earn the same collateral surplus as they would if there was no gas compensation and no virtual debt.

**Example:**

ETH:USD price: 100 $ per ETH

LQTY:USD price: 1 $ per CLV (expected peg)

Trove Minimum Collateral Ratio: 110%

| Trove A           |                                            |
|-------------------|--------------------------------------------|
| Trove collateral: | 1 ETH                                      |
| Trove debt:       | 81 CLV                                     |
| Virtual debt:     | 10 CLV                                     |
| Effective ICR:    | (1 * 100) / (81 + 10) = 100 / 91 = 109.89% |

_-> Trove A is liquidated. Gas compensation is paid to the liquidator, the trove’s debt is fully offset with the CLV in the Stability Pool, and its remaining collateral is distributed to Stability depositors_

Gas compensation paid to liquidator: ($10 worth of ETH) = 0.1 ETH

Debt offset with Stability Pool: 81 CLV 
Collateral distributed to depositors: (1 - 0.1 ) = 0.9 ETH

Net gain for the Stability Pool:  (0.9 * 100) - 81  = $9

Thus, the $10 virtual debt allows the system to pay $10 worth of gas compensation out to the liquidator, and still yield an attractive net gain in value for the Stability depositors ( when the trove is liquidated at > 100% ICR).


## Gas compensation Functionality

Gas compensation functions are found in the parent _LiquityBase.sol_ contract:

`_getGasCompensation(uint _entireColl, uint _price)`

`_getCompositeDebt(uint _debt)`


## Enabling Gas Compensation In the Smart Contracts ##

Gas compensation is currently **disabled**: that is, liquidations pay 0 ETH to the caller, and ICR calculations use 0 virtual debt. The reason for disabling is that the unit test suite was written before a gas compensation design was settled on, and thus many tests fail with it enabled. We are currently refactoring the test suite to decouple it from any specific gas compensation schedule.

Currently, with gas compensation disabled, all unit tests (except gas compensation tests!) pass.

The gas compensation and virtual debt functionality is simply commented out in the above two functions.

To **enable** gas compensation, please un-comment the relevant gas compensation and virtual debt sections in the above two functions in _LiquityBase.sol_

## Redistributions and Corrected Stakes

When a liquidation occurs and the Stability Pool is empty, the redistribution mechanism should distribute the collateral and debt of the liquidated trove, to all active troves in the system, in proportion to their collateral.

For two troves A and B with collateral `A.coll > B.coll`, trove A should earn a bigger share of the liquidated collateral and debt.

In Liquity it is important that all active troves remain ordered by their ICR. We have proven that redistribution of the liquidated debt and collateral proportional to active troves’ collateral, preserves the ordering of active troves by ICR, as liquidations occur over time.  Please see the [proofs section](https://github.com/liquity/dev/tree/main/packages/contracts/mathProofs).

However in the Solidity implementation, neither the collateral nor debt of active troves are compounded. When a trove receives redistribution rewards, the system does not update the trove's collateral and debt properties - instead, the trove’s rewards remain "pending" until the borrower's next operation.

These “pending rewards” can not be accounted for in future reward calculations in a scalable way.

However: the ICR of a CDP is always calculated as the ratio of its total collateral to its total debt. So, a trove’s ICR calculation **does** include all its previous accumulated rewards.

**This causes a problem: redistributions proportional to initial collateral can break CDP Ordering.**

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

- Proofs that CDP ordering is maintained throughout a series of liquidations and new loan issuances
- A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.

PDFs of these can be found in https://github.com/liquity/dev/tree/master/packages/contracts/mathProofs

## Definitions

**Note on naming**: Some terms are used interchangeably throughout the docs. CDP/Trove, LQTY/CLV, etc. These names are yet to be finalized.

_**Trove:**_ a collateralized debt position, bound to a single Ethereum address. Also referred to as a “CDP”.

_**CLV**_:  The stablecoin that may be issued from a user's collateralized debt position and freely transferred/traded to any Ethereum address. Intended to maintain parity with the US dollar, and can always be redeemed directly with the system: 1 CLV is always exchangeable for $1 USD worth of ETH.

_**Active trove:**_ an Ethereum address owns an “active trove” if there is a node in the sortedCDPs list with ID equal to the address, and non-zero collateral is recorded on the CDP struct for that address.

_**Closed trove:**_ a trove that was once active, but now has zero debt and zero collateral recorded on its struct, and there is no node in the sortedCDPs list with ID equal to the owning address.

_**Active collateral:**_ the amount of ETH collateral recorded on a trove’s struct

_**Active debt:**_ the amount of CLV debt recorded on a trove’s struct

_**Entire collateral:**_ the sum of a trove’s active collateral plus its pending collateral rewards accumulated from distributions

_**Entire debt:**_ the sum of a trove’s active debt plus its pending debt rewards accumulated from distributions

_**Individual collateral ratio (ICR):**_ a trove's ICR is the ratio of the dollar value of its entire collateral at the current ETH:USD price, to its entire debt

_**Total active collateral:**_ the sum of active collateral over all troves. Equal to the ETH in the ActivePool.

_**Total active debt:**_ the sum of active debt over all troves. Equal to the CLV in the ActivePool.

_**Total defaulted collateral:**_ the total ETH collateral in the DefaultPool

_**Total defaulted debt:**_ the total CLV debt in the DefaultPool

_**Entire system collateral:**_ the sum of the collateral in the ActivePool and DefaultPool

_**Entire system debt:**_ the sum of the debt in the ActivePool and DefaultPool

_**Total collateral ratio (TCR):**_ the ratio of the dollar value of the entire system collateral at the current ETH:USD price, to the entire system debt

_**Critical collateral ratio (CCR):**_ 150%. When the TCR is below the CCR, the system enters Recovery Mode.

_**Borrower:**_ an externally owned account or contract that locks collateral in a trove and issues CLV tokens to their own address.They “borrow” CLV tokens against their ETH collateral.

_**Depositor:**_ an externally owned account or contract that has assigned CLV tokens to the Stability Pool, in order to earn returns from liquidations, and receive GT token issuance.

_**Redemption:**_ the act of swapping CLV tokens with the system, in return for an equivalent value of ETH. Any account with a CLV token balance may redeem them, whether or not they are a borrower.

When CLV is redeemed for ETH, the ETH is always withdrawn from the lowest collateral troves, in ascending order of their collateral ratio. A redeemer can not selectively target troves with which to swap CLV for ETH.

_**Repayment:**_ when a borrower sends CLV tokens to their own trove, reducing their debt, and increasing their collateral ratio.

_**Retrieval:**_ when a borrower with an active trove withdraws some or all of their ETH collateral from their own trove, either reducing their collateral ratio, or closing their trove (if they have zero debt and withdraw all their ETH)

_**Liquidation:**_ the act of force-closing an undercollateralized trove and redistributing its collateral and debt. When the Stability Pool is sufficiently large, the liquidated debt is offset with the Stability Pool, and the ETH distributed to depositors. If the liquidated debt can not be offset with the Pool, the system redistributes the liquidated collateral and debt directly to the active troves with >110% collateral ratio.

Liquidation functionality is permissionless and publically available - anyone may liquidate an undercollateralized trove, or batch liquidate troves in ascending order of collateral ratio.

_**Offset:**_ cancellation of liquidated debt with CLV in the Stability Pool, and assignment of liquidated collateral to Stability Pool depositors, in proportion to their deposit.

_**Distribution:**_ assignment of liquidated debt and collateral directly to active troves, in proportion to their collateral.

_**Gas compensation:**_ A refund, in ETH, automatically paid to the caller of a liquidation function, intended to at least cover the gas cost of the transaction. Designed to ensure that liquidators are not dissuaded by potentially high gas costs.

## Development

The Liquity monorepo is based on Yarn's [workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) feature. You might be able to install some of the packages individually with npm, but to make all interdependent packages see each other, you'll need to use Yarn.

In addition, some package scripts require Docker to be installed (Docker Desktop on Windows and Mac, Docker Engine on Linux).

### Prerequisites

You'll need to install the following:

- [Git](https://help.github.com/en/github/getting-started-with-github/set-up-git) (of course)
- [Node v10.x](https://nodejs.org/dist/latest-v10.x/)
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
