# Liquity System Summary

Liquity is a collateralized stablecoin platform. Users can lock up ether, and issue stablecoin tokens (CLV) to their own Ethereum address, and subsequently transfer those tokens to any other Ethereum address.

The stablecoin tokens are economically guaranteed to maintain value of 1 CLV = $1 USD, due to two system properties:

1. The system will always be over-collateralized - the dollar value of the locked ether exceeds the dollar value of the issued stablecoins

2. The stablecoins are fully redeemable - users can always swap $x worth of CLV for $x worth of ETH, directly with the system.

After opening a CDP with some ether, they may issue tokens such that the collateral ratio of their CDP remains above 110%. A user with $1000 worth of ETH in a CDP can issue up to $909.09 worth of CLV.

Tokens are freely exchangeable - anyone with an Ethereum address can send or receive CLV tokens, whether they have an open CDP or not.

The Liquity system regularly updates the ETH:USD price via a trusted data feed. When a CDP falls below a minimum 110% collateral ratio, it is considered under-collateralized, and is vulnerable to liquidation.

## Liquidation

Liquity redistributes the collateral and debt from under-collateralized loans. It distributes primarily to CLV holders who have added tokens to the Stability Pool.  

Any user may deposit CLV tokens to the Stability Pool. This allows them to earn “rewards” over time, from liquidated CDPs. Stability Pool depositors can expect a net gain from their deposited tokens, as they receive a share of the collateral surplus of liquidated CDPs.

Anyone may call the public `liquidateCDPs()` function, which will check for under-collateralized loans, and liquidate them.

Liquity redistributes liquidations in two ways: firstly, it tries to cancel as much debt as possible with the tokens in the stability pool, and distributes the liquidated collateral between the Stability Pool participants.

Secondly, if the Pool is not sufficient to cancel with the liquidated debt, the system distributes the liquidated collateral and debt across all active CDPs.

## Rewards From Liquidations

Stability Pool depositors earn rewards in ether over time. When they withdraw all or part of their deposited tokens, or top up their deposit, they system sends them their accumulated ETH gains. 

Similarly, a CDP’s accumulated rewards from liquidations are automatically applied when the owner performs any operation - e.g. adding/withdrawing collateral, or issuing/repaying CLV.

## Recovery Mode

Recovery mode kicks in when the total collateral ratio (TCR) of the system falls below 150%.

During recovery mode, liquidation conditions are relaxed, and the system blocks issuance of new CLV. Recovery Mode is structured to incentive borrowers to behave in ways that promptly raise the TCR back above 150%.

Recovery Mode is designed to incentivise collateral top-ups, and also itself acts as a self-negating deterrent: the possibility of it actually guides the system away from ever reaching it.

## Project Structure

Liquity uses the `truffle-react` box template, and and follows the default Truffle project structure. The project runs on Truffle v5.1.5.

### Directories

- `contracts/` -The core back end smart contracts written in Solidity
- `test/` - JS test suite for the system. Tests run in Mocha/Chai
- `migrations/` - contains for deploying the smart contracts to the blockchain
- `utils/` - external truffle scripts - deployment helpers, gas calculators, etc
- `client/` - contains the front-end React app. Front-end development code could be placed here. Alternatively, the contracts could be added to a new project for development in React or a different responsive front-end framework.

Going forward, backend development will be done in the Buidler framework, which is compatible with Truffle projects, and allows Liquity to be deployed on the Buidler EVM network for faster compilation and test execution.

## System Architecture

The core Liquity system consists of several smart contracts, which are deployable to the Ethereum blockchain.

All application logic and data is contained in these contracts - there is no need for a seperate database or back end logic running on a web server. In effect, the Ethereum network is itself the Liquity back end. As such, all balances and contract data are public.

The two main contracts - `CDPManager.sol` and `PoolManager.sol` - hold the user-facing public functions, and contain most of the internal logic. They control movements of ether and tokens around the system.

### Core Smart Contracts

`CDPManager.sol` - contains functionality for borrower CDP operations: CDP loan creation, CDP loan ETH top-up / withdrawal, stablecoin issuance and repayment. Also contains functionality for liquidating CDPs that have fallen below the minimum collateral ratio.

`PoolManager.sol` - contains functionality for Stability Pool operations: depositing and withdrawing tokens. Also directs transfers of ether and tokens between pools.

`CLVToken.sol` - the stablecoin token contract, which implements the ERC20 fungible token standard. The contract mints, burns and transfers CLV tokens.

`SortedCDPs.sol` - a doubly linked that stores addresses of CDP owners, sorted by their individual collateral ratio (ICR). Inserts and re-inserted CDPS at the correct position, based on their ICR.

`PriceFeed.sol` - Contains the current ETH:USD price, which the system will use for calculating collateral ratios. Currently, the price is set by the admin. This contract willl eventually regularly obtain current and trusted ETH:USD price data.

### Data and Value Silo Contracts

These contracts hold ether and/or tokens for their respective parts of the system, and contain minimal logic. 
 
`CLVTokenData.sol` - contains the record of stablecoin balances.

`StabilityPool.sol` stores ether and stablecoin tokens deposited by users in the StabilityPool.

`ActivePool.sol` stores ether and stablecoin debts of the active loans.

`DefaultPool.sol` holds the ether and stablecoin debts of the liquidated loans.

### Helper Contracts

`NameRegistry.sol` - stores the names and addresses of deployed contracts.

`DeciMath.sol` - contains functions for decimal mathematics on Solidity.

`FunctionCaller.sol` - proxy contract, not part of the core system. Used only for testing gas usage of functions.

### Contract Interfaces

`ICDPManager.sol`, `IPool.sol` etc. These provide specification for a contract’s functions, without implementation. They are similar to interfaces in Java or C#.

## Expected User Behaviours

Generally, borrowers call functions that trigger CDP operations on their own CDP. Stability Pool users (who may or may not also be borrowers) call functions that trigger Stability Pool operations, such as depositing or withdrawing tokens to/from the Stability Pool.

Anyone may call the public liquidation functions, and attempt to liquidate one or several CDPs.

CLV token holders may also redeem their tokens, and swap an amount of tokens 1-for-1 in value with ether.

## Contract Ownership and Function Permissions

All the core smart contracts inherit from the OpenZeppelin `Ownable.sol` contract template. As such all contracts have a single owning address, which is the deploying address.

Several public and external functions have modifiers such as `onlyCDPManager`, `onlyPoolManager`, etc - ensuring they can only be called by the respective permitted contract.

## Deployment to a Development Blockchain

As a Truffle project, Liquity can be deployed to the Ganache framework:

```
truffle compile
truffle migrate --reset
```

The migration script deploys all contracts, registers them in in the NameRegistry, and connects all contracts to their dependency contracts, by setting the necessary deployed addresses.

The project will eventually be deployed on the Ropsten testnet.

## Running Tests

Run all tests with `truffle test`, or run a specific test with` truffle test ./test/contractTest.js`

It is recommended to first launch an instance of Ganache with plenty of ether (e.g. 10k) for each account, e.g:

`ganache-cli -I 4447 -p 7545 --gasLimit=9900000 -e 10000`


## Units for Quantities

Unless otherwise specified, all ether quantities are expressed in units of wei. 

All ratios, CLV quantities, and the ETH:USD price are integer representations of decimals, to 18 decimal places of precision. For example:

| **uint representation of decimal** | **Number**       |
|--------------------------------|---------------|
| 1100000000000000000                        | 110           |
| 200000000000000000000                         | 200           |
| 1000000000000000000                         | 1             |
| 5432100000000000000                   | 5.4321        |
| 34560000000                    | 0.00000003456 |
| 3700000000000000000000                       | 320           |
| 1                              | 1e-18         |

etc.

## Public Data

All data structures with the ‘public’ visibility specifier are ‘gettable’, with getters automatically generated by the compiler. Simply call `CDPManager::MCR()` to get the MCR, etc.
 
## Public User-Facing Functions

### Borrower CDP Operations - _CDPManager.sol_

`userCreateCDP()`: creates a CDP for the caller, with zero collateral and debt.

`addColl( address _user, address _hint)`: payable function that adds the received ether to the given user’s CDP. If the user does not have a CDP, a new one is opened. Allows any user to add ether to any other user’s CDP. The initial ether must exceed $20 USD in value.

`withdrawColl(uint _amount, address _hint)`: withdraws `_amount` of collateral from the caller’s CDP. Executes only if the user has an active CDP, and the withdrawal would not pull the user’s CDP below the minimum collateral ratio. If it is a partial withdrawal, it must not leave a remaining collateral with value below $20 USD.

`withdrawCLV(uint _amount, address_hint)`: issues `_amount` of CLV from the caller’s CDP to the caller. Executes only if the resultant colalteral ratio would remain above the minimum.

`repayCLV(uint _amount, uint _hint)`: repay `_amount` of CLV to the caller’s CDP.

### CDPManager Liquidation Functions  - _CDPManager.sol_

`liquidate(address _user)`: callable by anyone, attempts to liquidate the CDP of `_user`. Executes successfully if `_user`’s CDP is below the minimum collateral ratio.

`liquidateCDPs(n)`: callable by anyone, checks for under-collateralised CDPs and liquidates up to `n`, subject to gas constraints and the actual number of under-collateralized CDPs.

`redeemCollateral(uint _CLVamount, address _hint)`: redeems `_CLVamount` of stablecoins for ether from the system. Decreases the caller’s CLV balance, and sends them the corresponding amount of ETH. Executes successfully if the caller has sufficient CLV to redeem.

`getCurrentICR(_user)`: computes the user’s individual collateral ratio based on their total collateral and total CLV debt. Returns 2^256 -1 if they have 0 debt.

`getCDPOwnersCount(`): get the number of active CDPs in the system

### Stability Pool Functions - *PoolManager.sol*

`provideToSP(uint _amount)`: allows stablecoin holders to deposit `_amount` of CLV to the Stability Pool. If they already have tokens in the pool, it sends all accumulated ETH gains to their address. It tops up their CLV deposit by `_amount`, and reduces their CLV balance by `_amount`.

`withdrawFromSP(uint _amount)`: allows a stablecoin holder to withdraw `_amount` of CLV from the Stability Pool. Sends all their accumulated ETH gains to their address, and increases their CLV balance by `_amount`. Any CLV left after withdrawal remains in the Stability Pool and will earn further rewards for the user.

`withdrawFromSPtoCDP(address _user)`: sends the user’s entire accumulated ETH gain to their address, and updates their CLV deposit. If called by an externally owned account, the argument _user must be the calling account.

`withdrawPenaltyFromSP(address _address)`: if a user has ‘overstayed’ in the Stability Pool past the point at which their deposit was depleted, their subsequent ETH gains are available for anyone to claim. This function sends any claimable ETH to the caller’s address, and any legitimate ETH gain (from before the overstay penalty began) to the `_address`.

### Individual Pool Functions - *StabilityPool.sol*, *ActivePool.sol*, *DefaultPool.sol*

`getRawEtherBalance()`: returns the actual raw ether balance of the contract. Dictinct from the ETH public variable, which returns the total recorded ETH deposits. 

### Name Registry

`getAddress(string memory name)`: returns the given contract's deployed address on the blockchain. The `name` argument must be passed as title case, e.g. “PoolManager”

## Supplying Hints to CDP operations

CDPs in Liquity are recorded in a sorted doubly linked list, sorted by their ICR, from high to low.

All CDP operations change the collateral ratio need to either insert or reinsert the CDP to the `SortedCDPs` list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, a ‘hint’ may be provided.

A hint is the address of a CDP with a position in the sorted list close to the correct insert position.

All CDP operations take a ‘hint’ argument. The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call.

The `getApproxHint()` function can be used to generate a useful hint, which can then be passed as an argument to the desired CDP operation. 

**CDP operation without a hint**

1. User performs CDP operation in their browser
2. Call the CDP operation with `_hint = userAddress`

Gas cost will be worst case O(n), where n is the size of the `SortedCDPs` list.

**CDP operation with hint**

1. User performs CDP operation in their browser
2. The front end computes a new collateral ratio locally, based on the change in collateral and/or debt.
3. Call `CDPManager::getApproxHint()`, passing it the computed collateral ratio. Returns an address close to the correct insert position
4. Call `SortedCDPs::findInsertPosition()`, passing it the hint. Returns the exact insert position.
5. Pass the exact position as an argument to the CDP operation function call

Gas cost of steps 2-4 will be free, and step 5 will be O(1).

Hints allow cheaper CDP operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to Infura, unless the front end operator is running a full Ethereum node.
