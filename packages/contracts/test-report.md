# Test coverage

To check test coverage you can run:
```
yarn coverage
```

You can see the coverage status at mainnet deployment [here](https://codecov.io/gh/liquity/dev/tree/8f52f2906f99414c0b1c3a84c95c74c319b7a8c6).

![Impacted file tree graph](https://codecov.io/gh/liquity/dev/pull/707/graphs/tree.svg?width=650&height=150&src=pr&token=7AJPQ3TW0O&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=liquity)

There’s also a [pull request](https://github.com/liquity/dev/pull/515) to increase the coverage, but it hasn’t been merged yet because it modifies some smart contracts (mostly removing unnecessary checks).

# Test output
The following is the output of a complete test run, made on commit [`a1824dd8`](https://github.com/liquity/dev/tree/a1824dd88f4928b424cae372d59c4455d5c9a2c2), from April 16th, 2021.

```
yarn run v1.22.11
$ hardhat test


  Contract: Access Control: Liquity functions with the caller restricted to Liquity contract(s)
    BorrowerOperations
      ✓ moveETHGainToTrove(): reverts when called by an account that is not StabilityPool
    TroveManager
      ✓ applyPendingRewards(): reverts when called by an account that is not BorrowerOperations
      ✓ updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations
      ✓ removeStake(): reverts when called by an account that is not BorrowerOperations
      ✓ updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations
      ✓ closeTrove(): reverts when called by an account that is not BorrowerOperations
      ✓ addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations
      ✓ setTroveStatus(): reverts when called by an account that is not BorrowerOperations
      ✓ increaseTroveColl(): reverts when called by an account that is not BorrowerOperations
      ✓ decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations
      ✓ increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations
      ✓ decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations
    ActivePool
      ✓ sendETH(): reverts when called by an account that is not BO nor TroveM nor SP
      ✓ increaseLUSDDebt(): reverts when called by an account that is not BO nor TroveM
      ✓ decreaseLUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP
      ✓ fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool
    DefaultPool
      ✓ sendETHToActivePool(): reverts when called by an account that is not TroveManager
      ✓ increaseLUSDDebt(): reverts when called by an account that is not TroveManager
      ✓ decreaseLUSD(): reverts when called by an account that is not TroveManager
      ✓ fallback(): reverts when called by an account that is not the Active Pool
    StabilityPool
      ✓ offset(): reverts when called by an account that is not TroveManager
      ✓ fallback(): reverts when called by an account that is not the Active Pool
    LUSDToken
      ✓ mint(): reverts when called by an account that is not BorrowerOperations
      ✓ burn(): reverts when called by an account that is not BO nor TroveM nor SP
      ✓ sendToPool(): reverts when called by an account that is not StabilityPool
      ✓ returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool
    SortedTroves
      ✓ insert(): reverts when called by an account that is not BorrowerOps or TroveM
      ✓ remove(): reverts when called by an account that is not TroveManager
      ✓ reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager
    LockupContract
      ✓ withdrawLQTY(): reverts when caller is not beneficiary (68ms)
    LQTYStaking
      ✓ increaseF_LUSD(): reverts when caller is not TroveManager
    LQTYToken
      ✓ sendToLQTYStaking(): reverts when caller is not the LQTYSstaking (49ms)
    CommunityIssuance
      ✓ sendLQTY(): reverts when caller is not the StabilityPool
      ✓ issueLQTY(): reverts when caller is not the StabilityPool

  Contract: BorrowerOperations
    Without proxy
      ✓ addColl(): reverts when top-up would leave trove with ICR < MCR (278ms)
      ✓ addColl(): Increases the activePool ETH and raw ether balance by correct amount (203ms)
      ✓ addColl(), active Trove: adds the correct collateral amount to the Trove (194ms)
      ✓ addColl(), active Trove: Trove is in sortedList before and after (213ms)
      ✓ addColl(), active Trove: updates the stake and updates the total stakes (225ms)
      ✓ addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots (736ms)
      ✓ addColl(), reverts if trove is non-existent or closed (831ms)
      ✓ addColl(): can add collateral in Recovery Mode (252ms)
      ✓ withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR (349ms)
      ✓ withdrawColl(): reverts when calling address does not have active trove (328ms)
      ✓ withdrawColl(): reverts when system is in Recovery Mode (420ms)
      ✓ withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral (508ms)
      ✓ withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR (313ms)
      ✓ withdrawColl(): reverts if system is in Recovery Mode (323ms)
      ✓ withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation) (352ms)
      ✓ withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral (263ms)
      ✓ withdrawColl(): reduces the Trove's collateral by the correct amount (316ms)
      ✓ withdrawColl(): reduces ActivePool ETH and raw ether by correct amount (291ms)
      ✓ withdrawColl(): updates the stake and updates the total stakes (342ms)
      ✓ withdrawColl(): sends the correct amount of ETH to the user (289ms)
      ✓ withdrawColl(): applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots (1205ms)
      ✓ withdrawLUSD(): reverts when withdrawal would leave trove with ICR < MCR (516ms)
      ✓ withdrawLUSD(): decays a non-zero base rate (1192ms)
      ✓ withdrawLUSD(): reverts if max fee > 100% (668ms)
      ✓ withdrawLUSD(): reverts if max fee < 0.5% in Normal mode (639ms)
      ✓ withdrawLUSD(): reverts if fee exceeds max fee percentage (938ms)
      ✓ withdrawLUSD(): succeeds when fee is less than max fee percentage (1272ms)
      ✓ withdrawLUSD(): doesn't change base rate if it is already zero (1044ms)
      ✓ withdrawLUSD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation (899ms)
      ✓ withdrawLUSD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity (852ms)
      ✓ withdrawLUSD(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract (1004ms)
      ✓ withdrawLUSD(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct (923ms)
      ✓ withdrawLUSD(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked (986ms)
      ✓ withdrawLUSD(): Borrowing at non-zero base rate sends requested amount to the user (1562ms)
      ✓ withdrawLUSD(): Borrowing at zero base rate changes LUSD fees-per-unit-staked (839ms)
      ✓ withdrawLUSD(): Borrowing at zero base rate sends debt request to user (790ms)
      ✓ withdrawLUSD(): reverts when calling address does not have active trove (370ms)
      ✓ withdrawLUSD(): reverts when requested withdrawal amount is zero LUSD (459ms)
      ✓ withdrawLUSD(): reverts when system is in Recovery Mode (649ms)
      ✓ withdrawLUSD(): reverts when withdrawal would bring the trove's ICR < MCR (347ms)
      ✓ withdrawLUSD(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR (439ms)
      ✓ withdrawLUSD(): reverts if system is in Recovery Mode (312ms)
      ✓ withdrawLUSD(): increases the Trove's LUSD debt by the correct amount (208ms)
      ✓ withdrawLUSD(): increases LUSD debt in ActivePool by correct amount (230ms)
      ✓ withdrawLUSD(): increases user LUSDToken balance by correct amount (243ms)
      ✓ repayLUSD(): reverts when repayment would leave trove with ICR < MCR (392ms)
      ✓ repayLUSD(): Succeeds when it would leave trove with net debt >= minimum net debt (435ms)
      ✓ repayLUSD(): reverts when it would leave trove with net debt < minimum net debt (256ms)
      ✓ repayLUSD(): reverts when calling address does not have active trove (431ms)
      ✓ repayLUSD(): reverts when attempted repayment is > the debt of the trove (418ms)
      ✓ repayLUSD(): reduces the Trove's LUSD debt by the correct amount (403ms)
      ✓ repayLUSD(): decreases LUSD debt in ActivePool by correct amount (406ms)
      ✓ repayLUSD(): decreases user LUSDToken balance by correct amount (404ms)
      ✓ repayLUSD(): can repay debt in Recovery Mode (557ms)
      ✓ repayLUSD(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment (1122ms)
      ✓ adjustTrove(): reverts when adjustment would leave trove with ICR < MCR (572ms)
      ✓ adjustTrove(): reverts if max fee < 0.5% in Normal mode (313ms)
      ✓ adjustTrove(): allows max fee < 0.5% in Recovery mode (577ms)
      ✓ adjustTrove(): decays a non-zero base rate (1218ms)
      ✓ adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt (935ms)
      ✓ adjustTrove(): doesn't change base rate if it is already zero (545ms)
      ✓ adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation (819ms)
      ✓ adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity (866ms)
      ✓ adjustTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract (889ms)
      ✓ adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct (1013ms)
      ✓ adjustTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked (837ms)
      ✓ adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user (895ms)
      ✓ adjustTrove(): Borrowing at zero base rate changes LUSD balance of LQTY staking contract (783ms)
      ✓ adjustTrove(): Borrowing at zero base rate changes LQTY staking contract LUSD fees-per-unit-staked (881ms)
      ✓ adjustTrove(): Borrowing at zero base rate sends total requested LUSD to the user (783ms)
      ✓ adjustTrove(): reverts when calling address has no active trove (416ms)
      ✓ adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR (654ms)
      ✓ adjustTrove(): collateral withdrawal reverts in Recovery Mode (370ms)
      ✓ adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode (497ms)
      ✓ adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode (596ms)
      ✓ adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR (599ms)
      ✓ adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR (524ms)
      ✓ adjustTrove(): debt increase in Recovery Mode charges no fee (543ms)
      ✓ adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR (587ms)
      ✓ adjustTrove(): reverts when LUSD repaid is > debt of the trove (451ms)
      ✓ adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral (683ms)
      ✓ adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR (521ms)
      ✓ adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll (289ms)
      ✓ adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt (354ms)
      ✓ adjustTrove(): updates borrower's debt and coll with an increase in both (558ms)
      ✓ adjustTrove(): updates borrower's debt and coll with a decrease in both (553ms)
      ✓ adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease (375ms)
      ✓ adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase (346ms)
      ✓ adjustTrove(): updates borrower's stake and totalStakes with a coll increase (385ms)
      ✓ adjustTrove():  updates borrower's stake and totalStakes with a coll decrease (553ms)
      ✓ adjustTrove(): changes LUSDToken balance by the requested decrease (529ms)
      ✓ adjustTrove(): changes LUSDToken balance by the requested increase (577ms)
      ✓ adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease (1371ms)
      ✓ adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent (548ms)
      ✓ adjustTrove(): Changes the LUSD debt in ActivePool by requested decrease (541ms)
      ✓ adjustTrove(): Changes the LUSD debt in ActivePool by requested increase (397ms)
      ✓ adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR (385ms)
      ✓ adjustTrove(): Reverts if requested debt increase and amount is zero (292ms)
      ✓ adjustTrove(): Reverts if requested coll withdrawal and ether is sent (288ms)
      ✓ adjustTrove(): Reverts if it’s zero adjustment (137ms)
      ✓ adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral (402ms)
      ✓ adjustTrove(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment (496ms)
      ✓ Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender (475ms)
      ✓ closeTrove(): reverts when it would lower the TCR below CCR (471ms)
      ✓ closeTrove(): reverts when calling address does not have active trove (221ms)
      ✓ closeTrove(): reverts when system is in Recovery Mode (746ms)
      ✓ closeTrove(): reverts when trove is the only one in the system (497ms)
      ✓ closeTrove(): reduces a Trove's collateral to zero (582ms)
      ✓ closeTrove(): reduces a Trove's debt to zero (398ms)
      ✓ closeTrove(): sets Trove's stake to zero (504ms)
      ✓ closeTrove(): zero's the troves reward snapshots (1002ms)
      ✓ closeTrove(): sets trove's status to closed and removes it from sorted troves list (526ms)
      ✓ closeTrove(): reduces ActivePool ETH and raw ether by correct amount (466ms)
      ✓ closeTrove(): reduces ActivePool debt by correct amount (522ms)
      ✓ closeTrove(): updates the the total stakes (790ms)
      ✓ closeTrove(): sends the correct amount of ETH to the user (390ms)
      ✓ closeTrove(): subtracts the debt of the closed Trove from the Borrower's LUSDToken balance (405ms)
      ✓ closeTrove(): applies pending rewards (1267ms)
      ✓ closeTrove(): reverts if borrower has insufficient LUSD balance to repay his entire debt (347ms)
      ✓ openTrove(): emits a TroveUpdated event with the correct collateral and debt (820ms)
      ✓ openTrove(): Opens a trove with net debt >= minimum net debt (235ms)
      ✓ openTrove(): reverts if net debt < minimum net debt (294ms)
      ✓ openTrove(): decays a non-zero base rate (959ms)
      ✓ openTrove(): doesn't change base rate if it is already zero (911ms)
      ✓ openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation (953ms)
      ✓ openTrove(): reverts if max fee > 100% (56ms)
      ✓ openTrove(): reverts if max fee < 0.5% in Normal mode (85ms)
      ✓ openTrove(): allows max fee < 0.5% in Recovery Mode (409ms)
      ✓ openTrove(): reverts if fee exceeds max fee percentage (747ms)
      ✓ openTrove(): succeeds when fee is less than max fee percentage (930ms)
      ✓ openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity (965ms)
      ✓ openTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract (923ms)
      ✓ openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct (865ms)
      ✓ openTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked (794ms)
      ✓ openTrove(): Borrowing at non-zero base rate sends requested amount to the user (832ms)
      ✓ openTrove(): Borrowing at zero base rate changes the LQTY staking contract LUSD fees-per-unit-staked (602ms)
      ✓ openTrove(): Borrowing at zero base rate charges minimum fee (316ms)
      ✓ openTrove(): reverts when system is in Recovery Mode and ICR < CCR (320ms)
      ✓ openTrove(): reverts when trove ICR < MCR (536ms)
      ✓ openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR (367ms)
      ✓ openTrove(): reverts if trove is already active (679ms)
      ✓ openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode (499ms)
      ✓ openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode (324ms)
      ✓ openTrove(): creates a new Trove and assigns the correct collateral and debt amount (127ms)
      ✓ openTrove(): adds Trove owner to TroveOwners array (136ms)
      ✓ openTrove(): creates a stake and adds it to total stakes (281ms)
      ✓ openTrove(): inserts Trove to Sorted Troves list (370ms)
      ✓ openTrove(): Increases the activePool ETH and raw ether balance by correct amount (294ms)
      ✓ openTrove(): records up-to-date initial snapshots of L_ETH and L_LUSDDebt (639ms)
      ✓ openTrove(): allows a user to open a Trove, then close it, then re-open it (687ms)
      ✓ openTrove(): increases the Trove's LUSD debt by the correct amount (129ms)
      ✓ openTrove(): increases LUSD debt in ActivePool by the debt of the trove (162ms)
      ✓ openTrove(): increases user LUSDToken balance by correct amount (85ms)
      ✓ getCompositeDebt(): returns debt + gas comp
      ✓ closeTrove(): fails if owner cannot receive ETH (440ms)
      getNewICRFromTroveChange() returns the correct ICR
        ✓ collChange = 0, debtChange = 0
        ✓ collChange = 0, debtChange is positive
        ✓ collChange = 0, debtChange is negative
        ✓ collChange is positive, debtChange is 0
        ✓ collChange is negative, debtChange is 0
        ✓ collChange is negative, debtChange is negative
        ✓ collChange is positive, debtChange is positive
        ✓ collChange is positive, debtChange is negative
        ✓ collChange is negative, debtChange is positive
      getNewTCRFromTroveChange() returns the correct TCR
        ✓ collChange = 0, debtChange = 0 (248ms)
        ✓ collChange = 0, debtChange is positive (630ms)
        ✓ collChange = 0, debtChange is negative (327ms)
        ✓ collChange is positive, debtChange is 0 (328ms)
        ✓ collChange is negative, debtChange is 0 (407ms)
        ✓ collChange is negative, debtChange is negative (605ms)
        ✓ collChange is positive, debtChange is positive (601ms)
        ✓ collChange is positive, debtChange is negative (609ms)
        ✓ collChange is negative, debtChange is positive (381ms)

  Contract: CollSurplusPool
    ✓ CollSurplusPool::getETH(): Returns the ETH balance of the CollSurplusPool after redemption (2203ms)
    ✓ CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations
    ✓ CollSurplusPool: claimColl(): Reverts if nothing to claim
    ✓ CollSurplusPool: claimColl(): Reverts if owner cannot receive ETH surplus (723ms)
    ✓ CollSurplusPool: reverts trying to send ETH to it
    ✓ CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager

  Contract: Deployment script - Sets correct contract addresses dependencies after deployment
    ✓ Sets the correct PriceFeed address in TroveManager
    ✓ Sets the correct LUSDToken address in TroveManager
    ✓ Sets the correct SortedTroves address in TroveManager
    ✓ Sets the correct BorrowerOperations address in TroveManager
    ✓ Sets the correct ActivePool address in TroveManager
    ✓ Sets the correct DefaultPool address in TroveManager
    ✓ Sets the correct StabilityPool address in TroveManager
    ✓ Sets the correct LQTYStaking address in TroveManager
    ✓ Sets the correct StabilityPool address in ActivePool
    ✓ Sets the correct DefaultPool address in ActivePool (133ms)
    ✓ Sets the correct BorrowerOperations address in ActivePool
    ✓ Sets the correct TroveManager address in ActivePool
    ✓ Sets the correct ActivePool address in StabilityPool
    ✓ Sets the correct BorrowerOperations address in StabilityPool
    ✓ Sets the correct LUSDToken address in StabilityPool
    ✓ Sets the correct TroveManager address in StabilityPool
    ✓ Sets the correct TroveManager address in DefaultPool
    ✓ Sets the correct ActivePool address in DefaultPool
    ✓ Sets the correct TroveManager address in SortedTroves
    ✓ Sets the correct BorrowerOperations address in SortedTroves
    ✓ Sets the correct TroveManager address in BorrowerOperations
    ✓ Sets the correct PriceFeed address in BorrowerOperations
    ✓ Sets the correct SortedTroves address in BorrowerOperations
    ✓ Sets the correct ActivePool address in BorrowerOperations
    ✓ Sets the correct DefaultPool address in BorrowerOperations
    ✓ Sets the correct LQTYStaking address in BorrowerOperations
    ✓ Sets the correct LQTYToken address in LQTYStaking
    ✓ Sets the correct ActivePool address in LQTYStaking
    ✓ Sets the correct ActivePool address in LQTYStaking
    ✓ Sets the correct ActivePool address in LQTYStaking
    ✓ Sets the correct BorrowerOperations address in LQTYStaking
    ✓ Sets the correct CommunityIssuance address in LQTYToken
    ✓ Sets the correct LQTYStaking address in LQTYToken
    ✓ Sets the correct LockupContractFactory address in LQTYToken
    ✓ Sets the correct LQTYToken address in LockupContractFactory
    ✓ Sets the correct LQTYToken address in CommunityIssuance
    ✓ Sets the correct StabilityPool address in CommunityIssuance

  Contract: DefaultPool
    ✓ sendETHToActivePool(): fails if receiver cannot receive ETH

  Contract: Fee arithmetic tests
    ✓ minutesPassedSinceLastFeeOp(): returns minutes passed for no time increase (197ms)
    ✓ minutesPassedSinceLastFeeOp(): returns minutes passed between time of last fee operation and current block.timestamp, rounded down to nearest minutes (982ms)
    ✓ decayBaseRateFromBorrowing(): returns the initial base rate for no time increase
    ✓ decayBaseRateFromBorrowing(): returns the initial base rate for less than one minute passed  (386ms)
    ✓ decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.01 (2908ms)
    ✓ decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.1 (3951ms)
    ✓ decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.34539284 (3651ms)
    ✓ decayBaseRateFromBorrowing(): returns correctly decayed base rate, for various durations. Initial baseRate = 0.9976 (4377ms)
    Basic exponentiation
      ✓ decPow(): for exponent = 0, returns 1, regardless of base (42ms)
      ✓ decPow(): for exponent = 1, returns base, regardless of base (86ms)
      ✓ decPow(): for base = 0, returns 0 for any exponent other than 0 (238ms)
      ✓ decPow(): for base = 1, returns 1 for any exponent (179ms)
      ✓ decPow(): for exponent = 2, returns the square of the base (86ms)
      ✓ decPow(): correct output for various bases and exponents (2032ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = 7776000 (seconds in three months) (8459ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = 2592000 (seconds in one month) (4815ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = 43200 (minutes in one month) (4387ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = 525600 (minutes in one year) (4454ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = 2628000 (minutes in five years) (4724ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = minutes in ten years (3847ms)
      ✓ decPow(): abs. error < 1e-9 for exponent = minutes in one hundred years (5802ms)
      - decPow(): overflow test: doesn't overflow for exponent = minutes in 1000 years

  Contract: Gas compensation tests
    ✓ _getCollGasCompensation(): returns the 0.5% of collaterall if it is < $10 in value
    ✓ _getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral < $10 in value
    ✓ getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value
    ✓ getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value (72ms)
    ✓ _getCompositeDebt(): returns (debt + 50) when collateral < $10 in value
    ✓ getCompositeDebt(): returns (debt + 50) collateral = $10 in value
    ✓ getCompositeDebt(): returns (debt + 50) when 0.5% of collateral > $10 in value (52ms)
    ✓ getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new troves (1147ms)
    ✓ Gas compensation from pool-offset liquidations. All collateral paid as compensation (1340ms)
    ✓ gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Compensates $10 worth of collateral, liquidates the remainder (1199ms)
    ✓ gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Compensates 0.5% of  collateral, liquidates the remainder (1333ms)
TCR: 238.086389539884110295
TCR: 11.892415157517211309
    ✓ Gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt (1541ms)
    ✓ gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt (1498ms)
    ✓ gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt (1547ms)
    ✓ liquidateTroves(): full offset.  Compensates the correct amount, and liquidates the remainder (1810ms)
    ✓ liquidateTroves(): full redistribution. Compensates the correct amount, and liquidates the remainder (1312ms)
    ✓ liquidateTroves(): full offset. Liquidation event emits the correct gas compensation and total liquidated coll and debt (1551ms)
    ✓ liquidateTroves(): full redistribution. Liquidation event emits the correct gas compensation and total liquidated coll and debt (1790ms)
    ✓ Trove ordering: same collateral, decreasing debt. Price successively increases. Troves should maintain ordering by ICR (1647ms)
    ✓ Trove ordering: increasing collateral, constant debt. Price successively increases. Troves should maintain ordering by ICR (3885ms)
    ✓ Trove ordering: Constant raw collateral ratio (excluding virtual debt). Price successively increases. Troves should maintain ordering by ICR (2042ms)

  Contract: LQTY Token
    ✓ balanceOf(): gets the balance of the account (43ms)
    ✓ totalSupply(): gets the total supply
    ✓ name(): returns the token's name
    ✓ symbol(): returns the token's symbol
    ✓ version(): returns the token contract's version
    ✓ decimal(): returns the number of decimal digits used
    ✓ allowance(): returns an account's spending allowance for another account's balance (48ms)
    ✓ approve(): approves an account to spend the specified ammount (47ms)
    ✓ approve(): reverts when spender param is address(0) (52ms)
    ✓ approve(): reverts when owner param is address(0) (60ms)
    ✓ transferFrom(): successfully transfers from an account which it is approved to transfer from (123ms)
    ✓ transfer(): increases the recipient's balance by the correct amount (42ms)
    ✓ transfer(): reverts when amount exceeds sender's balance (56ms)
    ✓ transfer(): transfer to a blacklisted address reverts (204ms)
    ✓ transfer(): transfer to or from the zero-address reverts (49ms)
    ✓ mint(): issues correct amount of tokens to the given address
    ✓ mint(): reverts when beneficiary is address(0)
    ✓ increaseAllowance(): increases an account's allowance by the correct amount
    ✓ decreaseAllowance(): decreases an account's allowance by the correct amount
    ✓ sendToLQTYStaking(): changes balances of LQTYStaking and calling account by the correct amounts (48ms)
    ✓ Initializes PERMIT_TYPEHASH correctly
    ✓ Initializes DOMAIN_SEPARATOR correctly
    ✓ Initial nonce for a given address is 0
    ✓ permit(): permits and emits an Approval event (replay protected) (88ms)
    ✓ permit(): fails with expired deadline
    ✓ permit(): fails with the wrong signature (46ms)

  Contract: HintHelpers
    ✓ setup: makes accounts with nominal ICRs increasing by 1% consecutively (76ms)
    ✓ getApproxHint(): returns the address of a Trove within sqrt(length) positions of the correct insert position (1441ms)
    ✓ getApproxHint(): returns the head of the list if the CR is the max uint256 value (270ms)
    ✓ getApproxHint(): returns the tail of the list if the CR is lower than ICR of any Trove (321ms)
    ✓ computeNominalCR()

  Contract: Deploying and funding One Year Lockup Contracts
    Deploying LCs
      ✓ LQTY Deployer can deploy LCs through the Factory (121ms)
      ✓ Anyone can deploy LCs through the Factory (71ms)
      ✓ LQTY Deployer can deploy LCs directly (43ms)
      ✓ Anyone can deploy LCs directly (43ms)
      ✓ LC deployment stores the beneficiary's address in the LC (1806ms)
      ✓ LC deployment through the Factory registers the LC in the Factory (99ms)
      ✓ LC deployment through the Factory records the LC contract address and deployer as a k-v pair in the Factory (90ms)
      ✓ LC deployment through the Factory sets the unlockTime in the LC (52ms)
      ✓ Direct deployment of LC sets the unlockTime in the LC (55ms)
      ✓ LC deployment through the Factory reverts when the unlockTime is < 1 year from system deployment (50ms)
      ✓ Direct deployment of LC reverts when the unlockTime is < 1 year from system deployment (54ms)
    Funding LCs
      ✓ LQTY transfer from LQTY deployer to their deployed LC increases the LQTY balance of the LC (397ms)
      ✓ LQTY Multisig can transfer LQTY to LCs deployed through the factory by anyone (168ms)
    Withdrawal attempts on funded, inactive LCs immediately after funding
      ✓ Beneficiary can't withdraw from their funded LC (346ms)
      ✓ LQTY multisig can't withraw from a LC which it funded (271ms)
      ✓ No one can withraw from a LC (78ms)

  Contract: Deploying the LQTY contracts: LCF, CI, LQTYStaking, and LQTYToken 
    CommunityIssuance deployment
      ✓ Stores the deployer's address
    LQTYStaking deployment
      ✓ Stores the deployer's address
    LQTYToken deployment
      ✓ Stores the multisig's address
      ✓ Stores the CommunityIssuance address
      ✓ Stores the LockupContractFactory address
      ✓ Mints the correct LQTY amount to the multisig's address: (64.66 million)
      ✓ Mints the correct LQTY amount to the CommunityIssuance contract address: 32 million
      ✓ Mints the correct LQTY amount to the bountyAddress EOA: 2 million
      ✓ Mints the correct LQTY amount to the lpRewardsAddress EOA: 1.33 million
    Community Issuance deployment
      ✓ Stores the deployer's address
      ✓ Has a supply cap of 32 million
      ✓ Liquity AG can set addresses if CI's LQTY balance is equal or greater than 32 million  (393ms)
      ✓ Liquity AG can't set addresses if CI's LQTY balance is < 32 million  (367ms)
    Connecting LQTYToken to LCF, CI and LQTYStaking
      ✓ sets the correct LQTYToken address in LQTYStaking (1866ms)
      ✓ sets the correct LQTYToken address in LockupContractFactory
      ✓ sets the correct LQTYToken address in CommunityIssuance (203ms)

  Contract: During the initial lockup period
    LQTY transfer during first year after LQTY deployment
      ✓ Liquity multisig can not transfer LQTY to a LC that was deployed directly (105ms)
      ✓ Liquity multisig can not transfer to an EOA or Liquity system contracts (302ms)
      ✓ Liquity multisig can not approve any EOA or Liquity system contract to spend their LQTY (546ms)
      ✓ Liquity multisig can not increaseAllowance for any EOA or Liquity contract (285ms)
      ✓ Liquity multisig can not decreaseAllowance for any EOA or Liquity contract (338ms)
      ✓ Liquity multisig can not be the sender in a transferFrom() call
      ✓ Liquity multisig can not stake their LQTY in the staking contract
      ✓ Anyone (other than Liquity multisig) can transfer LQTY to LCs deployed by anyone through the Factory (359ms)
      ✓ Anyone (other than Liquity multisig) can transfer LQTY to LCs deployed by anyone directly (141ms)
      ✓ Anyone (other than liquity multisig) can transfer to an EOA (106ms)
      ✓ Anyone (other than liquity multisig) can approve any EOA or to spend their LQTY
      ✓ Anyone (other than liquity multisig) can increaseAllowance for any EOA or Liquity contract (244ms)
      ✓ Anyone (other than liquity multisig) can decreaseAllowance for any EOA or Liquity contract (693ms)
      ✓ Anyone (other than liquity multisig) can be the sender in a transferFrom() call (62ms)
      ✓ Anyone (other than liquity AG) can stake their LQTY in the staking contract
    Lockup Contract Factory negative tests
      ✓ deployLockupContract(): reverts when LQTY token address is not set (197ms)
    Transferring LQTY to LCs
      ✓ Liquity multisig can transfer LQTY (vesting) to lockup contracts they deployed (198ms)
      ✓ Liquity multisig can transfer LQTY to lockup contracts deployed by anyone (1798ms)
    Deploying new LCs
      ✓ LQTY Deployer can deploy LCs through the Factory (46ms)
      ✓ Liquity multisig can deploy LCs through the Factory
      ✓ Anyone can deploy LCs through the Factory (80ms)
      ✓ LQTY Deployer can deploy LCs directly (44ms)
      ✓ Liquity multisig can deploy LCs directly (45ms)
      ✓ Anyone can deploy LCs directly (46ms)
      ✓ Anyone can deploy LCs with unlockTime = one year from deployment, directly and through factory (102ms)
      ✓ Anyone can deploy LCs with unlockTime > one year from deployment, directly and through factory (187ms)
      ✓ No one can deploy LCs with unlockTime < one year from deployment, directly or through factory (100ms)
      Withdrawal Attempts on LCs before unlockTime has passed 
        ✓ Liquity multisig can't withdraw from a funded LC they deployed for another beneficiary through the Factory before the unlockTime
        ✓ Liquity multisig can't withdraw from a funded LC that someone else deployed before the unlockTime (52ms)
        ✓ Beneficiary can't withdraw from their funded LC before the unlockTime (219ms)
        ✓ No one can withdraw from a beneficiary's funded LC before the unlockTime (475ms)

  Contract: After the initial lockup period has passed
    Deploying new LCs
      ✓ LQTY Deployer can deploy new LCs
      ✓ Anyone can deploy new LCs (42ms)
      ✓ Anyone can deploy new LCs with unlockTime in the past (65ms)
      ✓ Anyone can deploy new LCs with unlockTime in the future (46ms)
    Beneficiary withdrawal from initial LC
      ✓ A beneficiary can withdraw their full entitlement from their LC (256ms)
      ✓ A beneficiary on a vesting schedule can withdraw their total vested amount from their LC (155ms)
      ✓ Beneficiaries can withraw full LQTY balance of LC if it has increased since lockup period ended (234ms)
    Withdrawal attempts from LCs by non-beneficiaries
      ✓ LQTY Multisig can't withdraw from a LC they deployed through the Factory
      ✓ LQTY Multisig can't withdraw from a LC that someone else deployed
      ✓ Non-beneficiaries cannot withdraw from a LC (189ms)
    Transferring LQTY
      ✓ LQTY multisig can transfer LQTY to LCs they deployed (176ms)
      ✓ LQTY multisig can transfer tokens to LCs deployed by anyone (104ms)
      ✓ LQTY multisig can transfer LQTY directly to any externally owned account (141ms)
      ✓ Anyone can transfer LQTY to LCs deployed by anyone (179ms)
      ✓ Anyone can transfer to an EOA (421ms)
      ✓ Anyone can approve any EOA to spend their LQTY
      ✓ Anyone can increaseAllowance for any EOA or Liquity contract (2441ms)
      ✓ Anyone can decreaseAllowance for any EOA or Liquity contract (1034ms)
      ✓ Anyone can be the sender in a transferFrom() call (101ms)
      ✓ Anyone can stake their LQTY in the staking contract (55ms)
    Withdrawal Attempts on new LCs before unlockTime has passed
      ✓ LQTY Deployer can't withdraw from a funded LC they deployed for another beneficiary through the Factory, before the unlockTime (44ms)
      ✓ LQTY Deployer can't withdraw from a funded LC that someone else deployed, before the unlockTime (448ms)
      ✓ Beneficiary can't withdraw from their funded LC, before the unlockTime (284ms)
      ✓ No one can withdraw from a beneficiary's funded LC, before the unlockTime (443ms)
    Withdrawals from new LCs after unlockTime has passed
      ✓ LQTY Deployer can't withdraw from a funded LC they deployed for another beneficiary through the Factory, after the unlockTime (100ms)
      ✓ LQTY multisig can't withdraw from a funded LC when they are not the beneficiary, after the unlockTime (529ms)
      ✓ Beneficiary can withdraw from their funded LC, after the unlockTime (97ms)
      ✓ Non-beneficiaries can't withdraw from a beneficiary's funded LC, after the unlockTime (226ms)

  Contract: LiquityMath
    ✓ max works if a > b
    ✓ max works if a = b
    ✓ max works if a < b

  Contract: LiquitySafeMath128Tester
    ✓ add(): reverts if overflows
    ✓ sub(): reverts if underflows

  Contract: LQTY community issuance arithmetic tests
issuance fraction before: 949066037374286
issuance fraction after: 949066037374286
    ✓ getCumulativeIssuanceFraction(): fraction doesn't increase if less than a minute has passed (45ms)
    ✓ Cumulative issuance fraction is 0.0000013 after a minute
    ✓ Cumulative issuance fraction is 0.000079 after an hour
    ✓ Cumulative issuance fraction is 0.0019 after a day
    ✓ Cumulative issuance fraction is 0.013 after a week (283ms)
    ✓ Cumulative issuance fraction is 0.055 after a month (38ms)
    ✓ Cumulative issuance fraction is 0.16 after 3 months
    ✓ Cumulative issuance fraction is 0.29 after 6 months (38ms)
    ✓ Cumulative issuance fraction is 0.5 after a year
    ✓ Cumulative issuance fraction is 0.75 after 2 years
    ✓ Cumulative issuance fraction is 0.875 after 3 years (44ms)
    ✓ Cumulative issuance fraction is 0.9375 after 4 years (50ms)
    ✓ Cumulative issuance fraction is 0.999 after 10 years
    ✓ Cumulative issuance fraction is 0.999999 after 20 years (78ms)
    ✓ Cumulative issuance fraction is 0.999999999 after 30 years (55ms)
    ✓ Total LQTY tokens issued is 42.20 after a minute (38ms)
    ✓ Total LQTY tokens issued is 2,531.94 after an hour (41ms)
    ✓ Total LQTY tokens issued is 60,711.40 after a day (136ms)
    ✓ Total LQTY tokens issued is 422,568.60 after a week (331ms)
    ✓ Total LQTY tokens issued is 1,772,113.21 after a month
    ✓ Total LQTY tokens issued is 5,027,363.22 after 3 months (40ms)
    ✓ Total LQTY tokens issued is 9,264,902.04 after 6 months (47ms)
    ✓ Total LQTY tokens issued is 16,000,000 after a year (47ms)
    ✓ Total LQTY tokens issued is 24,000,000 after 2 years (47ms)
    ✓ Total LQTY tokens issued is 28,000,000 after 3 years (75ms)
    ✓ Total LQTY tokens issued is 30,000,000 after 4 years (40ms)
    ✓ Total LQTY tokens issued is 31,968,750 after 10 years (69ms)
    ✓ Total LQTY tokens issued is 31,999,969.48 after 20 years (68ms)
    ✓ Total LQTY tokens issued is 31,999,999.97 after 30 years (87ms)
    - Frequent token issuance: issuance event every year, for 30 years
    - Frequent token issuance: issuance event every day, for 30 years
    - Frequent token issuance: issuance event every minute, for 1 month
    - Frequent token issuance: issuance event every minute, for 1 year

  Contract: LQTYStaking revenue share tests
    ✓ stake(): reverts if amount is zero (74ms)
    ✓ ETH fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0 (1562ms)
    ✓ ETH fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0 (3540ms)
    ✓ LUSD fee per LQTY staked increases when a redemption fee is triggered and totalStakes > 0 (1757ms)
    ✓ LUSD fee per LQTY staked doesn't change when a redemption fee is triggered and totalStakes == 0 (1705ms)
    ✓ LQTY Staking: A single staker earns all ETH and LQTY fees that occur (2143ms)
    ✓ stake(): Top-up sends out all accumulated ETH and LUSD gains to the staker (2138ms)
    ✓ getPendingETHGain(): Returns the staker's correct pending ETH gain (1856ms)
    ✓ getPendingLUSDGain(): Returns the staker's correct pending LUSD gain (1965ms)
    ✓ LQTY Staking: Multiple stakers earn the correct share of all ETH and LQTY fees, based on their stake size (3133ms)
    ✓ unstake(): reverts if caller has ETH gains and can't receive ETH (1149ms)
    ✓ receive(): reverts when it receives ETH from an address that is not the Active Pool
    ✓ unstake(): reverts if user has no stake
    ✓ Test requireCallerIsTroveManager

  Contract: LUSDToken
    Basic token functions, without Proxy
      ✓ balanceOf(): gets the balance of the account
      ✓ totalSupply(): gets the total supply
      ✓ name(): returns the token's name
      ✓ symbol(): returns the token's symbol
      ✓ decimal(): returns the number of decimal digits used
      ✓ allowance(): returns an account's spending allowance for another account's balance (77ms)
      ✓ approve(): approves an account to spend the specified amount
      ✓ approve(): reverts when spender param is address(0)
      ✓ approve(): reverts when owner param is address(0)
      ✓ transferFrom(): successfully transfers from an account which is it approved to transfer from (272ms)
      ✓ transfer(): increases the recipient's balance by the correct amount
      ✓ transfer(): reverts if amount exceeds sender's balance
      ✓ transfer(): transferring to a blacklisted address reverts (79ms)
      ✓ increaseAllowance(): increases an account's allowance by the correct amount (94ms)
      ✓ mint(): issues correct amount of tokens to the given address
      ✓ burn(): burns correct amount of tokens from the given address
      ✓ sendToPool(): changes balances of Stability pool and user by the correct amounts
      ✓ returnFromPool(): changes balances of Stability pool and user by the correct amounts (39ms)
      ✓ transfer(): transferring to a blacklisted address reverts (76ms)
      ✓ decreaseAllowance(): decreases allowance by the expected amount (38ms)
      ✓ decreaseAllowance(): fails trying to decrease more than previously allowed (39ms)
      ✓ version(): returns the token contract's version
      ✓ Initializes PERMIT_TYPEHASH correctly
      ✓ Initializes DOMAIN_SEPARATOR correctly
      ✓ Initial nonce for a given address is 0
      ✓ permits and emits an Approval event (replay protected) (69ms)
      ✓ permits(): fails with expired deadline (59ms)
      ✓ permits(): fails with the wrong signature (51ms)
    Basic token functions, with Proxy
      ✓ balanceOf(): gets the balance of the account (92ms)
      ✓ totalSupply(): gets the total supply (51ms)
      ✓ name(): returns the token's name
      ✓ symbol(): returns the token's symbol
      ✓ decimal(): returns the number of decimal digits used
      ✓ allowance(): returns an account's spending allowance for another account's balance
      ✓ approve(): approves an account to spend the specified amount
      ✓ transferFrom(): successfully transfers from an account which is it approved to transfer from (90ms)
      ✓ transfer(): increases the recipient's balance by the correct amount
      ✓ transfer(): reverts if amount exceeds sender's balance
      ✓ transfer(): transferring to a blacklisted address reverts (213ms)
      ✓ increaseAllowance(): increases an account's allowance by the correct amount (39ms)
      ✓ transfer(): transferring to a blacklisted address reverts (112ms)
      ✓ decreaseAllowance(): decreases allowance by the expected amount
      ✓ decreaseAllowance(): fails trying to decrease more than previously allowed (49ms)

  Contract: All Liquity functions with onlyOwner modifier
    TroveManager
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (857ms)
    BorrowerOperations
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (765ms)
    DefaultPool
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (154ms)
    StabilityPool
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (441ms)
    ActivePool
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (468ms)
    SortedTroves
      ✓ setParams(): reverts when called by non-owner, with wrong addresses, or twice (157ms)
    CommunityIssuance
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (136ms)
    LQTYStaking
      ✓ setAddresses(): reverts when called by non-owner, with wrong addresses, or twice (261ms)
    LockupContractFactory
      ✓ setLQTYAddress(): reverts when called by non-owner, with wrong address, or twice (216ms)

  Contract: StabilityPool
    ✓ getETH(): gets the recorded ETH balance
    ✓ getTotalLUSDDeposits(): gets the recorded LUSD balance

  Contract: ActivePool
    ✓ getETH(): gets the recorded ETH balance
    ✓ getLUSDDebt(): gets the recorded LUSD balance
    ✓ increaseLUSD(): increases the recorded LUSD balance by the correct amount
    ✓ decreaseLUSD(): decreases the recorded LUSD balance by the correct amount
    ✓ sendETH(): decreases the recorded ETH balance by the correct amount

  Contract: DefaultPool
    ✓ getETH(): gets the recorded LUSD balance
    ✓ getLUSDDebt(): gets the recorded LUSD balance
    ✓ increaseLUSD(): increases the recorded LUSD balance by the correct amount
    ✓ decreaseLUSD(): decreases the recorded LUSD balance by the correct amount (57ms)
    ✓ sendETHToActivePool(): decreases the recorded ETH balance by the correct amount (50ms)

  Contract: PriceFeed
    ✓ C1 Chainlink working: fetchPrice should return the correct price, taking into account the number of decimal digits on the aggregator (286ms)
    ✓ C1 Chainlink breaks, Tellor working: fetchPrice should return the correct Tellor price, taking into account Tellor's 6-digit granularity (2595ms)
    ✓ C1 chainlinkWorking: Chainlink broken by zero latest roundId, Tellor working: switch to usingChainlinkTellorUntrusted (87ms)
    ✓ C1 chainlinkWorking: Chainlink broken by zero latest roundId, Tellor working: use Tellor price (93ms)
    ✓ C1 chainlinkWorking: Chainlink broken by zero timestamp, Tellor working, switch to usingChainlinkTellorUntrusted (97ms)
    ✓ C1 chainlinkWorking:  Chainlink broken by zero timestamp, Tellor working, return Tellor price (97ms)
    ✓ C1 chainlinkWorking: Chainlink broken by future timestamp, Tellor working, switch to usingChainlinkTellorUntrusted (94ms)
    ✓ C1 chainlinkWorking: Chainlink broken by future timestamp, Tellor working, return Tellor price (99ms)
    ✓ C1 chainlinkWorking: Chainlink broken by negative price, Tellor working,  switch to usingChainlinkTellorUntrusted (85ms)
    ✓ C1 chainlinkWorking: Chainlink broken by negative price, Tellor working, return Tellor price (82ms)
    ✓ C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, switch to usingChainlinkTellorUntrusted (117ms)
    ✓ C1 chainlinkWorking: Chainlink broken - decimals call reverted, Tellor working, return Tellor price (99ms)
    ✓ C1 chainlinkWorking: Chainlink broken - latest round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted (92ms)
    ✓ C1 chainlinkWorking: latest round call reverted, Tellor working, return the Tellor price (100ms)
    ✓ C1 chainlinkWorking: previous round call reverted, Tellor working, switch to usingChainlinkTellorUntrusted (101ms)
    ✓ C1 chainlinkWorking: previous round call reverted, Tellor working, return Tellor Price (102ms)
    ✓ C1 chainlinkWorking: Chainlink frozen, Tellor working: switch to usingTellorChainlinkFrozen (112ms)
    ✓ C1 chainlinkWorking: Chainlink frozen, Tellor working: return Tellor price (123ms)
    ✓ C1 chainlinkWorking: Chainlink frozen, Tellor frozen: switch to usingTellorChainlinkFrozen (119ms)
    ✓ C1 chainlinkWorking: Chainlink frozen, Tellor frozen: return last good price (127ms)
    ✓ C1 chainlinkWorking: Chainlink times out, Tellor broken by 0 price: switch to usingChainlinkTellorUntrusted (320ms)
    ✓ C1 chainlinkWorking: Chainlink times out, Tellor broken by 0 price: return last good price (146ms)
    ✓ C1 chainlinkWorking: Chainlink is out of date by <3hrs: remain chainlinkWorking (92ms)
    ✓ C1 chainlinkWorking: Chainlink is out of date by <3hrs: return Chainklink price (132ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50%, switch to usingChainlinkTellorUntrusted (117ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50%, return the Tellor price (132ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of 50%, remain chainlinkWorking (83ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of 50%, return the Chainlink price (376ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of <50%, remain chainlinkWorking (89ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of <50%, return Chainlink price (99ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of >100%, switch to usingChainlinkTellorUntrusted (473ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of >100%, return Tellor price (117ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of 100%, remain chainlinkWorking (82ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of 100%, return Chainlink price (350ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of <100%, remain chainlinkWorking (136ms)
    ✓ C1 chainlinkWorking: Chainlink price increase of <100%,  return Chainlink price (87ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price matches: remain chainlinkWorking (154ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price matches: return Chainlink price (135ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: remain chainlinkWorking (109ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor price within 5% of Chainlink: return Chainlink price (101ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor live but not within 5% of Chainlink: switch to usingChainlinkTellorUntrusted (116ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor live but not within 5% of Chainlink: return Tellor price (276ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor frozen: switch to usingChainlinkTellorUntrusted (145ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor frozen: return last good price (2730ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: switch to bothOracleSuspect (68ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 price: return last good price (451ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: switch to bothOracleSuspect (121ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by 0 timestamp: return last good price (87ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by future timestamp: Pricefeed switches to bothOracleSuspect (81ms)
    ✓ C1 chainlinkWorking: Chainlink price drop of >50% and Tellor is broken by future timestamp: return last good price (119ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor is working - remain on chainlinkWorking (77ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor is working - return Chainlink price (168ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor freezes - remain on chainlinkWorking (469ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor freezes - return Chainlink price (167ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor breaks: switch to usingChainlinkTellorUntrusted (206ms)
    ✓ C1 chainlinkWorking: Chainlink is working and Tellor breaks: return Chainlink price (105ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: switch to bothOraclesSuspect (202ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by zero price: return last good price (107ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: switch to bothOraclesSuspect (296ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by call reverted: return last good price (112ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: switch to bothOraclesSuspect (2577ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor breaks by zero timestamp: return last good price (82ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor freezes - remain usingChainlinkTellorUntrusted (534ms)
    ✓ C2 usingTellorChainlinkUntrusted: Tellor freezes - return last good price (123ms)
    ✓ C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - switch to chainlinkWorking (68ms)
    ✓ C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and <= 5% price difference - return Chainlink price (65ms)
    ✓ C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and > 5% price difference - remain usingChainlinkTellorUntrusted (86ms)
    ✓ C2 usingTellorChainlinkUntrusted: both Tellor and Chainlink are live and > 5% price difference - return Tellor price (569ms)
    ✓ C3 bothOraclesUntrusted: both Tellor and Chainlink are live and > 5% price difference remain bothOraclesSuspect (56ms)
    ✓ C3 bothOraclesUntrusted: both Tellor and Chainlink are live and > 5% price difference, return last good price (82ms)
    ✓ C3 bothOraclesUntrusted: both Tellor and Chainlink are live and <= 5% price difference, switch to chainlinkWorking (72ms)
    ✓ C3 bothOraclesUntrusted: both Tellor and Chainlink are live and <= 5% price difference, return Chainlink price (84ms)
    ✓ C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, switch to bothOraclesSuspect (459ms)
    ✓ C4 usingTellorChainlinkFrozen: when both Chainlink and Tellor break, return last good price (112ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, switch to usingChainlinkTellorUntrusted (112ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor freezes, return last good price (99ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, switch to usingChainlinkTellorUntrusted (106ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink breaks and Tellor live, return Tellor price (102ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, switch back to chainlinkWorking (113ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with <5% price difference, return Chainlink current price (138ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with >5% price difference, switch back to usingChainlinkTellorUntrusted (2467ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with >5% price difference, return Chainlink current price (85ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with similar price, switch back to chainlinkWorking (537ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor is live with similar price, return Chainlink current price (82ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, switch to usingChainlinkTellorUntrusted (187ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink is live and Tellor breaks, return Chainlink current price (81ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor breaks, switch to usingChainlinkTellorUntrusted (176ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor broken, return last good price (213ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, remain usingTellorChainlinkFrozen (140ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor live, return Tellor price (236ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, remain usingTellorChainlinkFrozen (107ms)
    ✓ C4 usingTellorChainlinkFrozen: when Chainlink still frozen and Tellor freezes, return last good price (261ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - no status change (109ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price >5% - return Chainlink price (96ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live and Tellor price within <5%, switch to chainlinkWorking (171ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, Tellor price not within 5%, return Chainlink price (111ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, remain on usingChainlinkTellorUntrusted (161ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor price not within 5%, return Chainlink price (223ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor price not within 5%, remain on usingChainlinkTellorUntrusted (124ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous,  Tellor price not within 5%, return Chainlink price (182ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, and Tellor is frozen, remain on usingChainlinkTellorUntrusted (552ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, <50% price deviation from previous, Tellor is frozen, return Chainlink price (103ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor is frozen, remain on usingChainlinkTellorUntrusted (121ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink is live, >50% price deviation from previous, Tellor is frozen, return Chainlink price (105ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink frozen, remain on usingChainlinkTellorUntrusted (107ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink frozen, return last good price (531ms)
    ✓ C5 usingChainlinkTellorUntrusted: when Chainlink breaks too, switch to bothOraclesSuspect (87ms)
    ✓ C5 usingChainlinkTellorUntrusted: Chainlink breaks too, return last good price (99ms)
    PriceFeed internal testing contract
      ✓ fetchPrice before setPrice should return the default price
      ✓ should be able to fetchPrice after setPrice, output of former matching input of latter
    Mainnet PriceFeed setup
      ✓ fetchPrice should fail on contract with no chainlink address set
      ✓ fetchPrice should fail on contract with no tellor address set
      ✓ setAddresses should fail whe called by nonOwner
      ✓ setAddresses should fail after address has already been set (42ms)

  Contract: BorrowerWrappers
    ✓ proxy owner can recover ETH (85ms)
    ✓ non proxy owner cannot recover ETH
    ✓ claimCollateralAndOpenTrove(): reverts if nothing to claim (388ms)
    ✓ claimCollateralAndOpenTrove(): without sending any value (1227ms)
    ✓ claimCollateralAndOpenTrove(): sending value in the transaction (3969ms)
    ✓ claimSPRewardsAndRecycle(): only owner can call it (598ms)
    ✓ claimSPRewardsAndRecycle(): (1272ms)
    ✓ claimStakingGainsAndRecycle(): only owner can call it (1384ms)
    ✓ claimStakingGainsAndRecycle(): reverts if user has no trove (1253ms)
    ✓ claimStakingGainsAndRecycle(): with only ETH gain (1595ms)
    ✓ claimStakingGainsAndRecycle(): with only LUSD gain (821ms)
    ✓ claimStakingGainsAndRecycle(): with both ETH and LUSD gains (1593ms)

  Contract: SortedTroves
    SortedTroves
      ✓ contains(): returns true for addresses that have opened troves (552ms)
      ✓ contains(): returns false for addresses that have not opened troves (518ms)
      ✓ contains(): returns false for addresses that opened and then closed a trove (1009ms)
      ✓ contains(): returns true for addresses that opened, closed and then re-opened a trove (1399ms)
      ✓ contains(): returns false when there are no troves in the system
      ✓ contains(): true when list size is 1 and the trove the only one in system (208ms)
      ✓ contains(): false when list size is 1 and trove is not in the system (158ms)
      ✓ getMaxSize(): Returns the maximum list size
      ✓ Finds the correct insert position given two addresses that loosely bound the correct position (1135ms)
      - stays ordered after troves with 'infinite' ICR receive a redistribution
    SortedTroves with mock dependencies
      when params are wrongly set
        ✓ setParams(): reverts if size is zero
      when params are properly set
        ✓ insert(): fails if list is full (131ms)
        ✓ insert(): fails if list already contains the node (54ms)
        ✓ insert(): fails if id is zero
        ✓ insert(): fails if NICR is zero
        ✓ remove(): fails if id is not in the list
        ✓ reInsert(): fails if list doesn’t contain the node
        ✓ reInsert(): fails if new NICR is zero (43ms)
        ✓ findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail

  Contract: StabilityPool - LQTY Rewards
    LQTY Rewards
totalLQTYIssued_1: 30370113195977152000000
totalLQTYIssued_2: 30370113195977152000000
      ✓ liquidation < 1 minute after a deposit does not change totalLQTYIssued (743ms)
      ✓ withdrawFromSP(): reward term G does not update when no LQTY is issued (634ms)
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct LQTY gain. No liquidations. No front end. (1479ms)
      ✓ withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end. (1345ms)
      ✓ withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. No liquidations. No front end. (1925ms)
      ✓ withdrawFromSP(): Depositor withdraws correct LQTY gain after serial pool-emptying liquidations. No front-ends. (5752ms)
      ✓ LQTY issuance for a given period is not obtainable if the SP was empty during the period (551ms)
      ✓ withdrawFromSP(): Several deposits of 100 LUSD span one scale factor change. Depositors withdraw correct LQTY gains (6075ms)
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct LQTY gain. No liquidations. Front ends and kickback rates. (1660ms)
      ✓ withdrawFromSP(): Depositors with varying initial deposit withdraw correct LQTY gain. Front ends and kickback rates (2813ms)
      ✓ withdrawFromSP(): Several deposits of 10k LUSD span one scale factor change. Depositors withdraw correct LQTY gains (4788ms)

  Contract: Pool Manager: Sum-Product rounding errors
    - Rounding errors: 100 deposits of 100LUSD into SP, then 200 liquidations of 49LUSD

  Contract: StabilityPool - Withdrawal of stability deposit - Reward calculations
    Stability Pool Withdrawal
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation (757ms)
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations (868ms)
      ✓ withdrawFromSP():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations (1051ms)
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing LUSD (965ms)
      ✓ withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing LUSD (1152ms)
      ✓ withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations (934ms)
      ✓ withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations (1130ms)
      ✓ withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations (1193ms)

      ✓ withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (1512ms)
      ✓ withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (1637ms)
      ✓ withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (1645ms)
      ✓ withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (1704ms)
      ✓ withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct LUSD deposit and ETH Gain (1753ms)
      ✓ withdrawFromSP(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 LUSD. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (1537ms)
      ✓ withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool (3424ms)
      ✓ withdrawFromSP(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18 (1678ms)
      ✓ withdrawFromSP(): Depositors withdraw correct compounded deposit after liquidation empties the pool (1100ms)
      ✓ withdrawFromSP(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation (1049ms)
      ✓ withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool (4540ms)
      ✓ withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation (918ms)
      ✓ withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation (1187ms)
      ✓ withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation (778ms)
      ✓ withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation (3494ms)
alice deposit: 0
      ✓ withdrawFromSP(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0 (365ms)
      ✓ withdrawFromSP(): Several deposits of 10000 LUSD span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation (1676ms)
      ✓ withdrawFromSP(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation (1848ms)
      ✓ withdrawFromSP(): Depositor's ETH gain stops increasing after two scale changes (4134ms)
      ✓ withdrawFromSP(): Large liquidated coll/debt, deposits and ETH price (932ms)
      ✓ withdrawFromSP(): Small liquidated coll/debt, large deposits and ETH price (832ms)

  Contract: StabilityPool - Withdrawal of stability deposit - Reward calculations
    Stability Pool Withdrawal
      ✓ withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation (1227ms)
      ✓ withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations (1400ms)
      ✓ withdrawETHGainToTrove():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations (1827ms)
      ✓ withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing LUSD (1597ms)
      ✓ withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing LUSD (1711ms)
      ✓ withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations (1782ms)
      ✓ withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations (1798ms)
      ✓ withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations (4488ms)

      ✓ withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (2168ms)
      ✓ withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (5085ms)
      ✓ withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (2304ms)
      ✓ withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (2335ms)
      ✓ withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct LUSD deposit and ETH Gain (2145ms)
      ✓ withdrawETHGainToTrove(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 LUSD. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct LUSD deposit and ETH Gain (2543ms)
      ✓ withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool (1889ms)
      ✓ withdrawETHGainToTrove(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18 (1891ms)
      ✓ withdrawETHGainToTrove(): Depositors withdraw correct compounded deposit after liquidation empties the pool (2324ms)
      ✓ withdrawETHGainToTrove(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation (1719ms)
      ✓ withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool (3958ms)
      ✓ withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation (1276ms)
      ✓ withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation (4690ms)
      ✓ withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation (1460ms)
      ✓ withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation (1986ms)
alice deposit: 0
      ✓ withdrawETHGainToTrove(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0 (3725ms)
      ✓ withdrawETHGainToTrove(): Several deposits of 10000 LUSD span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation (2361ms)
      ✓ withdrawETHGainToTrove(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation (3814ms)
      ✓ withdrawETHGainToTrove(): Large liquidated coll/debt, deposits and ETH price (959ms)
      ✓ withdrawETHGainToTrove(): Small liquidated coll/debt, large deposits and ETH price (784ms)

  Contract: StabilityPool
    Stability Pool Mechanisms
      ✓ provideToSP(): increases the Stability Pool LUSD balance (354ms)
      ✓ provideToSP(): updates the user's deposit record in StabilityPool (355ms)
      ✓ provideToSP(): reduces the user's LUSD balance by the correct amount (321ms)
      ✓ provideToSP(): increases totalLUSDDeposits by correct amount (283ms)
      ✓ provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked (4003ms)
      ✓ provideToSP(), multiple deposits: updates user's deposit and snapshots (2543ms)
      ✓ provideToSP(): reverts if user tries to provide more than their LUSD balance (1030ms)
      ✓ provideToSP(): reverts if user tries to provide 2^256-1 LUSD, which exceeds their balance (508ms)
      ✓ provideToSP(): reverts if cannot receive ETH Gain (1073ms)
      ✓ provideToSP(): doesn't impact other users' deposits or ETH gains (1906ms)
      ✓ provideToSP(): doesn't impact system debt, collateral or TCR (2287ms)
      ✓ provideToSP(): doesn't impact any troves, including the caller's trove (1810ms)
      ✓ provideToSP(): doesn't protect the depositor's trove from liquidation (1082ms)
      ✓ provideToSP(): providing 0 LUSD reverts (1091ms)
      ✓ provideToSP(), new deposit: when SP > 0, triggers LQTY reward event - increases the sum G (1072ms)
      ✓ provideToSP(), new deposit: when SP is empty, doesn't update G (4734ms)
      ✓ provideToSP(), new deposit: sets the correct front end tag (1128ms)
      ✓ provideToSP(), new deposit: depositor does not receive any LQTY rewards (671ms)
      ✓ provideToSP(), new deposit after past full withdrawal: depositor does not receive any LQTY rewards (1679ms)
      ✓ provideToSP(), new eligible deposit: tagged front end receives LQTY rewards (1605ms)
      ✓ provideToSP(), new eligible deposit: tagged front end's stake increases (848ms)
      ✓ provideToSP(), new eligible deposit: tagged front end's snapshots update (1913ms)
      ✓ provideToSP(), new deposit: depositor does not receive ETH gains (957ms)
      ✓ provideToSP(), new deposit after past full withdrawal: depositor does not receive ETH gains (1928ms)
      ✓ provideToSP(), topup: triggers LQTY reward event - increases the sum G (1007ms)
      ✓ provideToSP(), topup from different front end: doesn't change the front end tag (1511ms)
      ✓ provideToSP(), topup: depositor receives LQTY rewards (1487ms)
      ✓ provideToSP(), topup: tagged front end receives LQTY rewards (1036ms)
      ✓ provideToSP(), topup: tagged front end's stake increases (1816ms)
      ✓ provideToSP(), topup: tagged front end's snapshots update (1816ms)
      ✓ provideToSP(): reverts when amount is zero (686ms)
      ✓ provideToSP(): reverts if user is a registered front end (802ms)
      ✓ provideToSP(): reverts if provided tag is not a registered front end (587ms)
      ✓ withdrawFromSP(): reverts when user has no active deposit (597ms)
      ✓ withdrawFromSP(): reverts when amount > 0 and system has an undercollateralized trove (453ms)
      ✓ withdrawFromSP(): partial retrieval - retrieves correct LUSD amount and the entire ETH Gain, and updates deposit (1102ms)
      ✓ withdrawFromSP(): partial retrieval - leaves the correct amount of LUSD in the Stability Pool (1128ms)
      ✓ withdrawFromSP(): full retrieval - leaves the correct amount of LUSD in the Stability Pool (1091ms)
      ✓ withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH (1494ms)
      ✓ withdrawFromSP(): it correctly updates the user's LUSD and ETH snapshots of entitled reward per unit staked (1049ms)
      ✓ withdrawFromSP(): decreases StabilityPool ETH (3952ms)
      ✓ withdrawFromSP(): All depositors are able to withdraw from the SP to their account (2393ms)
      ✓ withdrawFromSP(): increases depositor's LUSD token balance by the expected amount (2098ms)
      ✓ withdrawFromSP(): doesn't impact other users Stability deposits or ETH gains (4954ms)
      ✓ withdrawFromSP(): doesn't impact system debt, collateral or TCR  (1500ms)
      ✓ withdrawFromSP(): doesn't impact any troves, including the caller's trove (1085ms)
      ✓ withdrawFromSP(): succeeds when amount is 0 and system has an undercollateralized trove (933ms)
      ✓ withdrawFromSP(): withdrawing 0 LUSD doesn't alter the caller's deposit or the total LUSD in the Stability Pool (993ms)
      ✓ withdrawFromSP(): withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool (1139ms)
      ✓ withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit (1260ms)
      ✓ withdrawFromSP(): Request to withdraw 2^256-1 LUSD only withdraws the caller's compounded deposit (1229ms)
      ✓ withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode (4371ms)
      ✓ getDepositorETHGain(): depositor does not earn further ETH gains from liquidations while their compounded deposit == 0:  (1831ms)
      ✓ withdrawFromSP(): triggers LQTY reward event - increases the sum G (982ms)
      ✓ withdrawFromSP(), partial withdrawal: doesn't change the front end tag (1421ms)
      ✓ withdrawFromSP(), partial withdrawal: depositor receives LQTY rewards (1155ms)
      ✓ withdrawFromSP(), partial withdrawal: tagged front end receives LQTY rewards (1245ms)
      ✓ withdrawFromSP(), partial withdrawal: tagged front end's stake decreases (1803ms)
      ✓ withdrawFromSP(), partial withdrawal: tagged front end's snapshots update (1713ms)
      ✓ withdrawFromSP(), full withdrawal: removes deposit's front end tag (970ms)
      ✓ withdrawFromSP(), full withdrawal: zero's depositor's snapshots (1434ms)
      ✓ withdrawFromSP(), full withdrawal that reduces front end stake to 0: zero’s the front end’s snapshots (1248ms)
      ✓ withdrawFromSP(), reverts when initial deposit value is 0 (1037ms)
      ✓ withdrawETHGainToTrove(): reverts when user has no active deposit (1043ms)
      ✓ withdrawETHGainToTrove(): Applies LUSDLoss to user's deposit, and redirects ETH reward to user's Trove (932ms)
      ✓ withdrawETHGainToTrove(): reverts if it would leave trove with ICR < MCR (3920ms)
      ✓ withdrawETHGainToTrove(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH (976ms)
      ✓ withdrawETHGainToTrove(): decreases StabilityPool ETH and increases activePool ETH (976ms)
      ✓ withdrawETHGainToTrove(): All depositors are able to withdraw their ETH gain from the SP to their Trove (5974ms)
      ✓ withdrawETHGainToTrove(): All depositors withdraw, each withdraw their correct ETH gain (2591ms)
      ✓ withdrawETHGainToTrove(): caller can withdraw full deposit and ETH gain to their trove during Recovery Mode (1629ms)
      ✓ withdrawETHGainToTrove(): reverts if user has no trove (967ms)
      ✓ withdrawETHGainToTrove(): triggers LQTY reward event - increases the sum G (1298ms)
      ✓ withdrawETHGainToTrove(), partial withdrawal: doesn't change the front end tag (4778ms)
      ✓ withdrawETHGainToTrove(), eligible deposit: depositor receives LQTY rewards (1607ms)
      ✓ withdrawETHGainToTrove(), eligible deposit: tagged front end receives LQTY rewards (1701ms)
      ✓ withdrawETHGainToTrove(), eligible deposit: tagged front end's stake decreases (5345ms)
      ✓ withdrawETHGainToTrove(), eligible deposit: tagged front end's snapshots update (1984ms)
      ✓ withdrawETHGainToTrove(): reverts when depositor has no ETH gain (1172ms)
      ✓ registerFrontEnd(): registers the front end and chosen kickback rate (173ms)
      ✓ registerFrontEnd(): reverts if the front end is already registered (196ms)
      ✓ registerFrontEnd(): reverts if the kickback rate >1 (57ms)
      ✓ registerFrontEnd(): reverts if address has a non-zero deposit already (702ms)

  Contract: TroveManager
totalStakesSnapshot after L1: 200000002000000000000000000000
totalCollateralSnapshot after L1: 399000002000000000000000000000
Snapshots ratio after L1: 501253135332064484
B pending ETH reward after L1: 39799999602000003960000000000
B stake after L1: 40000000000000000000000000000
B stake after A1: 39999999999999999989974957243
Snapshots ratio after A1: 501253135332064484
B stake after L2: 39999999999999999989974957243
Snapshots ratio after L2: 501253134833317619
B stake after A2: 39999999999999999983267686056
B stake after L3: 39999999999999999983267686056
Snapshots ratio after L3: 501253134334570755
B stake after A3: 39999999999999999978023472178
B stake after L4: 39999999999999999978023472178
Snapshots ratio after L4: 501253133835823890
B stake after A4: 39999999999999999993921497875
B stake after L5: 39999999999999999993921497875
Snapshots ratio after L5: 501253133337077025
B stake after A5: 39999999999999999994797348633
B stake after L6: 39999999999999999994797348633
Snapshots ratio after L6: 501253132838330161
B stake after A6: 39999999999999999993468266716
B stake after L7: 39999999999999999993468266716
Snapshots ratio after L7: 501253132339583296
B stake after A7: 39999999999999999992497700314
B stake after L8: 39999999999999999992497700314
Snapshots ratio after L8: 501253131840836431
B stake after A8: 39999999999999999992398338824
B stake after L9: 39999999999999999992398338824
Snapshots ratio after L9: 501253131342089567
B stake after A9: 39999999999999999993272719884
B stake after L10: 39999999999999999993272719884
Snapshots ratio after L10: 501253130843342702
B stake after A10: 39999999999999999995141350785
B stake after L11: 39999999999999999995141350785
Snapshots ratio after L11: 501253130344595837
B stake after A11: 39999999999999999998008332745
    ✓ A given trove's stake decline is negligible with adjustments and tiny liquidations (4988ms)

  Contract: TroveManager - Redistribution reward calculations
    ✓ redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards (1514ms)
    ✓ redistribution: A, B, C Open. C Liquidated. D, E, F Open. F Liquidated. Distributes correct rewards (1537ms)
    ✓ redistribution: Sequence of alternate opening/liquidation: final surviving trove has ETH from all previously liquidated troves (1667ms)
    ✓ redistribution: A,B,C,D,E open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt (1915ms)
    ✓ redistribution: A,B,C,D open. Liq(A). B adds coll. Liq(C). B and D have correct coll and debt (1962ms)
    ✓ redistribution: A,B,C Open. Liq(C). B adds coll. Liq(A). B acquires all coll and debt (1102ms)
    ✓ redistribution: A,B,C Open. Liq(C). B tops up coll. D Opens. Liq(D). Distributes correct rewards. (1133ms)
    ✓ redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). C tops up. E Enters, Liq(E). Distributes correct rewards (1217ms)
    ✓ redistribution: Trove with the majority stake tops up. A,B,C, D open. Liq(D). A, B, C top up. E Enters, Liq(E). Distributes correct rewards (1627ms)
    ✓ redistribution: A,B,C Open. Liq(C). B withdraws coll. Liq(A). B acquires all coll and debt (1062ms)
    ✓ redistribution: A,B,C Open. Liq(C). B withdraws coll. D Opens. Liq(D). Distributes correct rewards. (1050ms)
    ✓ redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). C withdraws some coll. E Enters, Liq(E). Distributes correct rewards (1254ms)
    ✓ redistribution: Trove with the majority stake withdraws. A,B,C,D open. Liq(D). A, B, C withdraw. E Enters, Liq(E). Distributes correct rewards (2218ms)
    ✓ redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Distributes correct rewards (1990ms)
    ✓ redistribution, all operations: A,B,C open. Liq(A). D opens. B adds, C withdraws. Liq(B). E & F open. D adds. Liq(F). Varying coll. Distributes correct rewards (2513ms)

  Contract: TroveManager - in Recovery Mode
    ✓ checkRecoveryMode(): Returns true if TCR falls below CCR (555ms)
    ✓ checkRecoveryMode(): Returns true if TCR stays less than CCR (783ms)
    ✓ checkRecoveryMode(): returns false if TCR stays above CCR (775ms)
    ✓ checkRecoveryMode(): returns false if TCR rises above CCR (517ms)
    ✓ liquidate(), with ICR < 100%: removes stake and updates totalStakes (958ms)
    ✓ liquidate(), with ICR < 100%: updates system snapshots correctly (1181ms)
    ✓ liquidate(), with ICR < 100%: closes the Trove and removes it from the Trove array (808ms)
    ✓ liquidate(), with ICR < 100%: only redistributes to active Troves - no offset to Stability Pool (1527ms)
    ✓ liquidate(), with 100 < ICR < 110%: removes stake and updates totalStakes (969ms)
    ✓ liquidate(), with 100% < ICR < 110%: updates system snapshots correctly (1292ms)
    ✓ liquidate(), with 100% < ICR < 110%: closes the Trove and removes it from the Trove array (965ms)
    ✓ liquidate(), with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt (1034ms)
    ✓ liquidate(), with ICR > 110%, trove has lowest ICR, and StabilityPool is empty: does nothing (1245ms)
    ✓ liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: offsets the trove entirely with the pool (1265ms)
    ✓ liquidate(), with ICR% = 110 < TCR, and StabilityPool LUSD > debt to liquidate: offsets the trove entirely with the pool, there’s no collateral surplus (1382ms)
    ✓ liquidate(), with  110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: removes stake and updates totalStakes (1361ms)
    ✓ liquidate(), with  110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: updates system snapshots (1287ms)
    ✓ liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: closes the Trove (6532ms)
    ✓ liquidate(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: can liquidate troves out of order (2667ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: Trove remains active (985ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: Trove remains in TroveOwners array (1134ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: nothing happens (1146ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: updates system shapshots (1284ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: causes correct Pool offset and ETH gain, and doesn't redistribute to active troves (1266ms)
    ✓ liquidate(), with ICR > 110%, and StabilityPool LUSD < liquidated debt: ICR of non liquidated trove does not change (2161ms)
    ✓ liquidate() with ICR > 110%, and StabilityPool LUSD < liquidated debt: total liquidated coll and debt is correct (1912ms)
    ✓ liquidate(): Doesn't liquidate undercollateralized trove if it is the only trove in the system (652ms)
    ✓ liquidate(): Liquidates undercollateralized trove if there are two troves in the system (997ms)
    ✓ liquidate(): does nothing if trove has >= 110% ICR and the Stability Pool is empty (1019ms)
    ✓ liquidate(): does nothing if trove ICR >= TCR, and SP covers trove's debt (1391ms)
    ✓ liquidate(): reverts if trove is non-existent (815ms)
    ✓ liquidate(): reverts if trove has been closed (1044ms)
    ✓ liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt (1878ms)
    ✓ liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove (708ms)
    ✓ liquidate(): does not alter the liquidated user's token balance (1312ms)
    ✓ liquidate(), with 110% < ICR < TCR, can claim collateral, re-open, be reedemed and claim again (2055ms)
    ✓ liquidate(), with 110% < ICR < TCR, can claim collateral, after another claim from a redemption (2300ms)
    ✓ liquidateTroves(): With all ICRs > 110%, Liquidates Troves until system leaves recovery mode (3129ms)
    ✓ liquidateTroves(): Liquidates Troves until 1) system has left recovery mode AND 2) it reaches a Trove with ICR >= 110% (2467ms)
    ✓ liquidateTroves(): liquidates only up to the requested number of undercollateralized troves (7021ms)
    ✓ liquidateTroves(): does nothing if n = 0 (952ms)
    ✓ liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves (2065ms)
    ✓ liquidateTroves(): a liquidation sequence containing Pool offsets increases the TCR (2024ms)
    ✓ liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5% (6805ms)
    ✓ liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt (945ms)
    ✓ liquidateTroves(): does nothing if all troves have ICR > 110% and Stability Pool is empty (692ms)
    ✓ liquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves (1300ms)
    ✓ liquidateTroves():  emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial (1362ms)
    ✓ liquidateTroves(): does not affect the liquidated user's token balances (4805ms)
    ✓ liquidateTroves(): Liquidating troves at 100 < ICR < 110 with SP deposits correctly impacts their SP deposit and ETH gain (1556ms)
    ✓ liquidateTroves(): Liquidating troves at ICR <=100% with SP deposits does not alter their deposit or ETH gain (1391ms)
    ✓ liquidateTroves() with a non fullfilled liquidation: non liquidated trove remains active (1140ms)
    ✓ liquidateTroves() with a non fullfilled liquidation: non liquidated trove remains in TroveOwners Array (1378ms)
gasUsed:  609826
true
    ✓ liquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, emptied pool (4864ms)
gasUsed:  609826
    ✓ liquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, non emptied pool (1286ms)
    ✓ liquidateTroves() with a non fullfilled liquidation: total liquidated coll and debt is correct (1175ms)
    ✓ liquidateTroves() with a non fullfilled liquidation: emits correct liquidation event values (1364ms)
    ✓ liquidateTroves() with a non fullfilled liquidation: ICR of non liquidated trove does not change (1387ms)
    ✓ batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode (4957ms)
    ✓ batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Recovery -> Normal Mode (1492ms)
    ✓ batchLiquidateTroves(): Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode (1922ms)
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains active (1286ms)
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: non liquidated trove remains in Trove Owners array (1555ms)
gasUsed:  636956
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, emptied pool (1465ms)
gasUsed:  636956
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: still can liquidate further troves after the non-liquidated, non emptied pool (1521ms)
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: total liquidated coll and debt is correct (1320ms)
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: emits correct liquidation event values (1238ms)
    ✓ batchLiquidateTroves() with a non fullfilled liquidation: ICR of non liquidated trove does not change (1416ms)
    ✓ batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool LUSD > debt to liquidate: can liquidate troves out of order (1357ms)
    ✓ batchLiquidateTroves(), with 110% < ICR < TCR, and StabilityPool empty: doesn't liquidate any troves (1161ms)
    ✓ batchLiquidateTroves(): skips liquidation of troves with ICR > TCR, regardless of Stability Pool size (2686ms)
    ✓ batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves (1530ms)
    ✓ batchLiquidateTroves(): emits liquidation event with correct values when all troves have ICR > 110% and Stability Pool covers a subset of troves, including a partial (4965ms)

  Contract: TroveManager
    ✓ liquidate(): closes a Trove that has ICR < MCR (573ms)
    ✓ liquidate(): decreases ActivePool ETH and LUSDDebt by correct amounts (567ms)
    ✓ liquidate(): increases DefaultPool ETH and LUSD debt by correct amounts (553ms)
    ✓ liquidate(): removes the Trove's stake from the total stakes (608ms)
    ✓ liquidate(): Removes the correct trove from the TroveOwners array, and moves the last array element to the new empty slot (1276ms)
    ✓ liquidate(): updates the snapshots of total stakes and total collateral (422ms)
    ✓ liquidate(): updates the L_ETH and L_LUSDDebt reward-per-unit-staked totals (984ms)
    ✓ liquidate(): Liquidates undercollateralized trove if there are two troves in the system (503ms)
    ✓ liquidate(): reverts if trove is non-existent (303ms)
    ✓ liquidate(): reverts if trove has been closed (745ms)
    ✓ liquidate(): does nothing if trove has >= 110% ICR (597ms)
    ✓ liquidate(): Given the same price and no other trove changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves (2590ms)
    ✓ liquidate(): Pool offsets increase the TCR (6140ms)
    ✓ liquidate(): a pure redistribution reduces the TCR only as a result of compensation (2570ms)
    ✓ liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove (964ms)
    ✓ liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain (892ms)
    ✓ liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain (1141ms)
    ✓ liquidate(): does not alter the liquidated user's token balance (1104ms)
    ✓ liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt (1573ms)
    ✓ liquidate(): when SP > 0, triggers LQTY reward event - increases the sum G (1081ms)
    ✓ liquidate(): when SP is empty, doesn't update G (1127ms)
    ✓ liquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards (5574ms)
    ✓ liquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves (2003ms)
    ✓ liquidateTroves(): liquidates  up to the requested number of undercollateralized troves (1230ms)
    ✓ liquidateTroves(): does nothing if all troves have ICR > 110% (1021ms)
    ✓ liquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt (1246ms)
    ✓ liquidateTroves(): reverts if n = 0 (764ms)
    ✓ liquidateTroves():  liquidates troves with ICR < MCR (1751ms)
    ✓ liquidateTroves(): does not affect the liquidated user's token balances (999ms)
    ✓ liquidateTroves(): A liquidation sequence containing Pool offsets increases the TCR (6204ms)
    ✓ liquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5% (1929ms)
    ✓ liquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain (1214ms)
    ✓ liquidateTroves(): when SP > 0, triggers LQTY reward event - increases the sum G (5057ms)
    ✓ liquidateTroves(): when SP is empty, doesn't update G (1722ms)
    ✓ batchLiquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards (1912ms)
    ✓ batchLiquidateTroves(): closes every trove with ICR < MCR in the given array (1351ms)
    ✓ batchLiquidateTroves(): does not liquidate troves that are not in the given array (5228ms)
    ✓ batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array (1442ms)
    ✓ batchLiquidateTroves(): reverts if array is empty (978ms)
    ✓ batchLiquidateTroves(): skips if trove is non-existent (1295ms)
    ✓ batchLiquidateTroves(): skips if a trove has been closed (5183ms)
    ✓ batchLiquidateTroves: when SP > 0, triggers LQTY reward event - increases the sum G (1428ms)
    ✓ batchLiquidateTroves(): when SP is empty, doesn't update G (1655ms)
    ✓ getRedemptionHints(): gets the address of the first Trove and the final ICR of the last Trove involved in a redemption (621ms)
    ✓ getRedemptionHints(): returns 0 as partialRedemptionHintNICR when reaching _maxIterations (715ms)
    ✓ redeemCollateral(): cancels the provided LUSD with debt from Troves with the lowest ICRs and sends an equivalent amount of Ether (838ms)
    ✓ redeemCollateral(): with invalid first hint, zero address (991ms)
    ✓ redeemCollateral(): with invalid first hint, non-existent trove (1003ms)
    ✓ redeemCollateral(): with invalid first hint, trove below MCR (1392ms)
    ✓ redeemCollateral(): ends the redemption sequence when the token redemption request has been filled (1583ms)
    ✓ redeemCollateral(): ends the redemption sequence when max iterations have been reached (1038ms)
    ✓ redeemCollateral(): performs partial redemption if resultant debt is > minimum net debt (1411ms)
    ✓ redeemCollateral(): doesn't perform partial redemption if resultant debt would be < minimum net debt (1487ms)
    ✓ redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date (1583ms)
    - redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool
    ✓ redeemCollateral(): doesn't touch Troves with ICR < 110% (4743ms)
    ✓ redeemCollateral(): finds the last Trove with ICR == 110% even if there is more than one (1124ms)
    ✓ redeemCollateral(): reverts when TCR < MCR (1238ms)
    ✓ redeemCollateral(): reverts when argument _amount is 0 (1038ms)
    ✓ redeemCollateral(): reverts if max fee > 100% (1918ms)
    ✓ redeemCollateral(): reverts if max fee < 0.5% (2011ms)
    ✓ redeemCollateral(): reverts if fee exceeds max fee percentage (2899ms)
    ✓ redeemCollateral(): succeeds if fee is less than max fee percentage (3127ms)
    ✓ redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves (2311ms)
    ✓ redeemCollateral(): caller can redeem their entire LUSDToken balance (1086ms)
    ✓ redeemCollateral(): reverts when requested redemption amount exceeds caller's LUSD token balance (1320ms)
    ✓ redeemCollateral(): value of issued ETH == face value of redeemed LUSD (assuming 1 LUSD has value of $1) (1353ms)
    ✓ redeemCollateral(): reverts if there is zero outstanding system debt (66ms)
    ✓ redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt (367ms)
    ✓ redeemCollateral(): a redemption made when base rate is zero increases the base rate (1187ms)
    ✓ redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed (1987ms)
    ✓ redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation [ @skip-on-coverage ] (2515ms)
    ✓ redeemCollateral(): a redemption made at zero base rate send a non-zero ETHFee to LQTY staking contract (5136ms)
    ✓ redeemCollateral(): a redemption made at zero base increases the ETH-fees-per-LQTY-staked in LQTY Staking contract (1207ms)
    ✓ redeemCollateral(): a redemption made at a non-zero base rate send a non-zero ETHFee to LQTY staking contract (1730ms)
    ✓ redeemCollateral(): a redemption made at a non-zero base rate increases ETH-per-LQTY-staked in the staking contract (5971ms)
    ✓ redeemCollateral(): a redemption sends the ETH remainder (ETHDrawn - ETHFee) to the redeemer (1113ms)
    ✓ redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove (1553ms)
    ✓ redeemCollateral(): emits correct debt and coll values in each redeemed trove's TroveUpdated event (1416ms)
    ✓ redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim (5373ms)
    ✓ redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner after re-opening trove (2154ms)
    ✓ redeemCollateral(): reverts if fee eats up all returned collateral (1412ms)
    ✓ getPendingLUSDDebtReward(): Returns 0 if there is no pending LUSDDebt reward (618ms)
    ✓ getPendingETHReward(): Returns 0 if there is no pending ETH reward (620ms)
    ✓ computeICR(): Returns 0 if trove's coll is worth 0
    ✓ computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 LUSD
    ✓ computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 LUSD
    ✓ computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 LUSD
    ✓ computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 LUSD
    ✓ computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt
    ✓ checkRecoveryMode(): Returns true when TCR < 150% (351ms)
    ✓ checkRecoveryMode(): Returns false when TCR == 150% (366ms)
    ✓ checkRecoveryMode(): Returns false when TCR > 150% (365ms)
    ✓ checkRecoveryMode(): Returns false when TCR == 0 (604ms)
    ✓ getTroveStake(): Returns stake (511ms)
    ✓ getTroveColl(): Returns coll (494ms)
    ✓ getTroveDebt(): Returns debt (400ms)
    ✓ getTroveStatus(): Returns status (434ms)
    ✓ hasPendingRewards(): Returns false it trove is not active

  Contract: Unipool
    Unipool
      ✓ Two stakers with the same stakes wait DURATION (112ms)
      ✓ Two stakers with the different (1:3) stakes wait DURATION (206ms)
      ✓ Two stakers with the different (1:3) stakes wait DURATION and DURATION/2 (93ms)
      ✓ Three stakers with the different (1:3:5) stakes wait different durations (392ms)
      ✓ Four stakers with gaps of zero total supply (516ms)
      ✓ Four stakers with gaps of zero total supply, with claims in between (430ms)
    Unipool, before calling setAddresses
      ✓ Stake fails
      ✓ Withdraw falis
      ✓ Claim fails
      ✓ Exit fails


  1019 passing (29m)
  8 pending

Done in 1740.19s.
```
