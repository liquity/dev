// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../BorrowerOperations.sol";
import "../TroveManager.sol";
import "../StabilityPool.sol";
import "../HintHelpers.sol";

contract E2E {

        using SafeMath for uint;

        address internal bo = 0xbe0037eAf2d64fe5529BCa93c18C9702D3930376;
        //address internal hh = X; // AccessControlTest.js should be modify to deploy HintHelper
        address internal ap = address(BorrowerOperations(bo).activePool());
        address internal dp = address(BorrowerOperations(bo).defaultPool());
        address internal sp = address(TroveManager(address(BorrowerOperations(bo).troveManager())).stabilityPool());
        address internal st = address(TroveManager(address(BorrowerOperations(bo).troveManager())).sortedTroves());
        address internal t =  address(BorrowerOperations(bo).lusdToken());


        function checkInvariants() internal view {
            assert(BorrowerOperations(bo).troveManager().getTroveOwnersCount() >= 1 && ISortedTroves(st).getSize() >= 1);
            assert(ap.balance == IPool(ap).getETH());
            assert(dp.balance == IPool(dp).getETH());
            assert(sp.balance == IPool(sp).getETH());
            assert(t.balance == 0);
            assert(st.balance == 0);
        }
 
        function checkMoreInvariants() public {

            uint totalSupply = ILUSDToken(t).totalSupply();
            uint gasPoolBalance = ILUSDToken(t).balanceOf(BorrowerOperations(bo).gasPoolAddress());

            uint activePoolBalance = IPool(ap).getLUSDDebt();
            uint defaultPoolBalance = IPool(dp).getLUSDDebt();
            uint totalStakes = TroveManager(address(BorrowerOperations(bo).troveManager())).totalStakes();

            // totalStakes > 0
            assert(totalStakes > 0);
            // totalStakes does not exceed activePool + defaultPool
            assert(totalStakes <= activePoolBalance.add(defaultPoolBalance));

            assert(ILUSDToken(t).balanceOf(address(this)) <= activePoolBalance.add(defaultPoolBalance));
            assert(totalSupply == activePoolBalance.add(defaultPoolBalance));

            uint stabilityPoolBalance = IStabilityPool(sp).getTotalLUSDDeposits();

            address currentTrove = ISortedTroves(st).getFirst();
            address nextTrove; 

            uint trovesBalance = 0;
            while (currentTrove != address(0)) {
                trovesBalance = trovesBalance.add(ILUSDToken(t).balanceOf(address(currentTrove)));
                currentTrove = ISortedTroves(st).getNext(currentTrove);
            }
            uint lqtyBalance = ILUSDToken(t).balanceOf(BorrowerOperations(bo).lqtyStakingAddress());
            assert (totalSupply >= stabilityPoolBalance.add(trovesBalance).add(gasPoolBalance).add(lqtyBalance));

            currentTrove = ISortedTroves(st).getFirst();
            while (currentTrove != address(0)) {
                // Status
                assert (BorrowerOperations(bo).troveManager().getTroveStatus(currentTrove) == uint256(TroveManager.Status.active));

                // Minimum debt (gas compensation)
                assert(BorrowerOperations(bo).troveManager().getTroveDebt(currentTrove) >= BorrowerOperations(bo).LUSD_GAS_COMPENSATION());

                // Stake > 0
                assert(BorrowerOperations(bo).troveManager().getTroveStake(currentTrove) > 0);
                currentTrove = ISortedTroves(st).getNext(currentTrove);
            }

            currentTrove = ISortedTroves(st).getFirst();
            nextTrove = ISortedTroves(st).getNext(currentTrove);
            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
 
            while (currentTrove != address(0) && nextTrove != address(0)) {
                assert (BorrowerOperations(bo).troveManager().getCurrentICR(nextTrove, price) <= BorrowerOperations(bo).troveManager().getCurrentICR(currentTrove, price));
                currentTrove = nextTrove;
                nextTrove = ISortedTroves(st).getNext(currentTrove);
            }
 
        }

        function getMinETH(uint ratio) internal returns (uint) {
            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            uint minETH = ratio.mul(BorrowerOperations(bo).LUSD_GAS_COMPENSATION()).div(price);
            return minETH;
        }

        function getAdjustedLUSD(uint ETH, uint _LUSDAmount, uint ratio) internal returns (uint) {
            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            uint LUSDAmount = _LUSDAmount;
            uint compositeDebt = LUSDAmount.add(BorrowerOperations(bo).LUSD_GAS_COMPENSATION());
            uint ICR = LiquityMath._computeCR(ETH, compositeDebt, price);
            if (ICR < ratio) {
               compositeDebt = ETH.mul(price).div(ratio);
               LUSDAmount = compositeDebt.sub(BorrowerOperations(bo).LUSD_GAS_COMPENSATION());
            }
            return LUSDAmount;
        }

	function openTrove_should_not_revert(uint _LUSDAmount) payable public {
            checkInvariants();
            bool rb = true;
            bytes memory rm;
            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();

            if (msg.value < getMinETH(BorrowerOperations(bo).CCR())) {
                // should revert if the ether is not enough
                (rb,rm) = bo.call{value: msg.value}(abi.encodeWithSignature("openTrove(uint256,address)", 0, address(this)));
                assert(!rb);
		return;
	    }

            if (BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) != 0)
                return;

            uint LUSDAmount = getAdjustedLUSD(msg.value, _LUSDAmount, BorrowerOperations(bo).CCR()); 
        
            if (BorrowerOperations(bo).troveManager().checkRecoveryMode(price)) {
                // This will revert sometimes, but we don't have a good specification 
                return;
            }

            uint tokensBefore = BorrowerOperations(bo).lusdToken().balanceOf(address(this));

            (rb,rm) = bo.call{value: msg.value}(abi.encodeWithSignature("openTrove(uint256,address)", LUSDAmount, address(this)));
            assert(rb);

            // post conditions
            // should be included in sorted troves
            assert(ISortedTroves(st).contains(address(this)));
            // should be active
            assert(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == uint256(TroveManager.Status.active));
            // owner should receive LUSD
            assert(BorrowerOperations(bo).lusdToken().balanceOf(address(this)) == tokensBefore + LUSDAmount);
            uint colAfter;
            (,colAfter,,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this)); 
            // should update collateral
            assert(msg.value == colAfter);
        }

	function addColl_should_not_revert() payable public {
            checkInvariants();
            bool rb = true;
            bytes memory rm;
            require(msg.value > 0);

            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1)) {
                (rb,rm) = bo.call{value: msg.value}(abi.encodeWithSignature("addColl(address)", address(this)));
                assert(!rb);
                return;
            }
            
            uint colBefore;
            (,colBefore,,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this));

            bool pendingRewardsBefore = BorrowerOperations(bo).troveManager().hasPendingRewards(address(this));

            // should not revert 
            (rb,rm) = bo.call{value: msg.value}(abi.encodeWithSignature("addColl(address)", address(this)));
            assert(rb);

            // post conditions
            // No pending rewards after call
            bool pendingRewardsAfter = BorrowerOperations(bo).troveManager().hasPendingRewards(address(this));
            assert(!pendingRewardsAfter);

            uint colAfter;
            (,colAfter,,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this)); 

            // should update collateral depending on the pending rewards
            if (!pendingRewardsBefore)
                assert(colBefore + msg.value == colAfter);
            else
                assert(colBefore + msg.value < colAfter);
        }

	function repayLUSD_should_not_revert() public {
            checkInvariants(); 
            uint tokens = BorrowerOperations(bo).lusdToken().balanceOf(address(this));
            require(tokens > 0);

            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1))
                return; 

            bool rb = true;
            bytes memory rm;

            // it should revert with more tokens
            (rb,rm) = bo.call(abi.encodeWithSignature("repayLUSD(uint256,address)", tokens+1, address(this)));
            assert(!rb);

            // it should not revert
            (rb,rm) = bo.call(abi.encodeWithSignature("repayLUSD(uint256,address)", tokens, address(this)));
            assert(rb);

            // post conditions
            // it should burn the LUSD from the owner
            assert(BorrowerOperations(bo).lusdToken().balanceOf(address(this)) == 0);

            // No pending rewards after call
            bool pendingRewardsAfter = BorrowerOperations(bo).troveManager().hasPendingRewards(address(this));
            assert(!pendingRewardsAfter);
        }

	function withdrawLUSD_should_not_revert() public {
            checkInvariants(); 

            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1))
                return; 

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            bool rb = true;
            bytes memory rm;

            if (BorrowerOperations(bo).troveManager().checkRecoveryMode(price)) {
                // it should revert in recovery mode
                (rb,rm) = bo.call(abi.encodeWithSignature("withdrawLUSD(uint256,address)", 1, address(this)));
                assert(!rb);
                return;
            }
            uint tokensBefore = BorrowerOperations(bo).lusdToken().balanceOf(address(this));
 
            // it should not revert
            (rb,rm) = bo.call(abi.encodeWithSignature("withdrawLUSD(uint256,address)", 1, address(this)));
            assert(rb);

            // post conditions
            // token balance should be updated
            uint tokensAfter = BorrowerOperations(bo).lusdToken().balanceOf(address(this));
            assert(tokensBefore + 1 == tokensAfter);

            // No pending rewards after call
            bool pendingRewardsAfter = BorrowerOperations(bo).troveManager().hasPendingRewards(address(this));
            assert(!pendingRewardsAfter);
        }

	function closeTrove_should_not_revert() public {
            checkInvariants(); 
            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1)) {
                return;
            }

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            bool rb = true;
            bytes memory rm;

            if (BorrowerOperations(bo).troveManager().checkRecoveryMode(price)) {
                (rb,rm) = bo.call(abi.encodeWithSignature("closeTrove()"));
                // should revert in recovery mode
                assert(!rb);
                return;
            }

            uint debt = BorrowerOperations(bo).troveManager().getTroveDebt(address(this));
            uint tokens = BorrowerOperations(bo).lusdToken().balanceOf(address(this));

            if (tokens < debt.sub(BorrowerOperations(bo).LUSD_GAS_COMPENSATION())) {
                (rb,rm) = bo.call(abi.encodeWithSignature("closeTrove()"));
                // should revert
                assert(!rb);
                return;
            }
            
            (rb,rm) = bo.call(abi.encodeWithSignature("closeTrove()"));
            // should not revert
            assert(rb);

            // postconditions
            uint debtAfter;
            uint stakeAfter;

            // debt and stake are zero
            (debtAfter,,stakeAfter,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this));
            assert(debtAfter == 0);
            assert(stakeAfter == 0);

            // rewards are zero
            uint rs1;
            uint rs2;
            (rs1,rs2) = TroveManager(address(BorrowerOperations(bo).troveManager())).rewardSnapshots(address(this));
            assert(rs1 == 0);
            assert(rs2 == 0); 
         
            // trove is removed
            assert(!ISortedTroves(st).contains(address(this)));

            // trove is closed
            assert(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == uint256(TroveManager.Status.closedByOwner));

            // No pending rewards after call
            bool pendingRewardsAfter = BorrowerOperations(bo).troveManager().hasPendingRewards(address(this));
            assert(!pendingRewardsAfter);
        }

	function liquidate_should_not_revert() public {
            checkInvariants(); 
            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1))
                return;

            require(ISortedTroves(st).getSize() >= 2);

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            uint ICR = BorrowerOperations(bo).troveManager().getCurrentICR(address(this), price);
        
            bool rb = true;
            bytes memory rm;

            (rb,rm) = address(BorrowerOperations(bo).troveManager()).call(abi.encodeWithSignature("liquidate(address)", address(this)));
            assert(rb);

            // postconditions
  
            if (ICR < TroveManager(address(BorrowerOperations(bo).troveManager())).MCR()) {
                // same as closing a trove
                uint debtAfter;
                uint stakeAfter;
                (debtAfter,,stakeAfter,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this));
                assert(debtAfter == 0);
                assert(stakeAfter == 0);

                uint rs1;
                uint rs2;
                (rs1,rs2) = TroveManager(address(BorrowerOperations(bo).troveManager())).rewardSnapshots(address(this));
                assert(rs1 == 0);
                assert(rs2 == 0); 
         
                assert(!ISortedTroves(st).contains(address(this)));
                assert(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == uint256(TroveManager.Status.closedByLiquidation));
            }
        }

	function liquidateTroves_should_not_revert(uint n) public {
            checkInvariants(); 
            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1))
                return; 
        
            bool rb = true;
            bytes memory rm;

            (rb,rm) = address(BorrowerOperations(bo).troveManager()).call(abi.encodeWithSignature("liquidateTroves(uint256)", n));
            // it should not revert
            assert(rb);
        }

        function batchLiquidateTroves_should_not_revert() public {
            checkInvariants(); 
 
            address[] memory borrowers = new address[](1);
            borrowers[0] = address(this);

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            uint ICR = BorrowerOperations(bo).troveManager().getCurrentICR(address(this), price);
 
            bool rb = true;
            bytes memory rm;

            (rb,rm) = address(BorrowerOperations(bo).troveManager()).call(abi.encodeWithSignature("batchLiquidateTroves(address[])", borrowers));
            assert(rb);

            // postconditions
  
            if (ICR < TroveManager(address(BorrowerOperations(bo).troveManager())).MCR()) {
                uint debtAfter;
                uint stakeAfter;
                (debtAfter,,stakeAfter,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this));
                assert(debtAfter == 0);
                assert(stakeAfter == 0);

                uint rs1;
                uint rs2;
                (rs1,rs2) = TroveManager(address(BorrowerOperations(bo).troveManager())).rewardSnapshots(address(this));
                assert(rs1 == 0);
                assert(rs2 == 0); 
         
                assert(!ISortedTroves(st).contains(address(this)));
                assert(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == uint256(TroveManager.Status.closedByLiquidation));
            }
        }

        function provideToSP_should_not_revert() public {
            checkInvariants(); 

            uint tokens = BorrowerOperations(bo).lusdToken().balanceOf(address(this));
            require(tokens > 0);
            
            bool rb = true;
            bytes memory rm;

            bool registered = false;
            (, registered) = StabilityPool(payable(sp)).frontEnds(address(this));

            if (registered) {
                // it should revert if caller is registered
                (rb,rm) = sp.call(abi.encodeWithSignature("provideToSP(uint256,address)", tokens, address(0x0)));
                assert(!rb);
                return;
            }

            // it should revert with more tokens than expected
            (rb,rm) = sp.call(abi.encodeWithSignature("provideToSP(uint256,address)", tokens+1, address(0x0)));
            assert(!rb);

            // it should not revert
            (rb,rm) = sp.call(abi.encodeWithSignature("provideToSP(uint256,address)", tokens, address(0x0)));
            assert(rb);
        }

        function withdrawFromSP_should_not_revert(uint tokens) public {
            checkInvariants(); 

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            bool rb = true;
            bytes memory rm;

            uint deposited = 0;
            (deposited,) = StabilityPool(payable(sp)).deposits(address(this));

            if (deposited == 0) {
                (rb,rm) = sp.call(abi.encodeWithSignature("withdrawFromSP(uint256)", tokens));
                assert(!rb);
                return;
            }

            if (BorrowerOperations(bo).troveManager().checkRecoveryMode(price)) {
                (rb,rm) = sp.call(abi.encodeWithSignature("withdrawFromSP(uint256)", tokens));
                assert(!rb);
                return;
            }

            (rb,rm) = sp.call(abi.encodeWithSignature("withdrawFromSP(uint256)", deposited));
            assert(rb);

            //post conditions
            // deposited tokens are zero
            (deposited,) = StabilityPool(payable(sp)).deposits(address(this));
            assert(deposited == 0);

            // if stabilityPoolBalance is zero, then epochToScaleToG(0, 0) > 0
            uint stabilityPoolBalance = IStabilityPool(sp).getTotalLUSDDeposits();
            if (stabilityPoolBalance == 0)
                assert(StabilityPool(payable(sp)).epochToScaleToG(0, 0) > 0);
        }

        function withdrawETHGainToTrove_should_not_revert() public {
            checkInvariants(); 
            if (!(BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1))
                return; 
           
            bool rb = true;
            bytes memory rm;

            uint deposited = 0;
            deposited = StabilityPool(payable(sp)).getDepositorETHGain(address(this));

            if (deposited == 0)
                return;
 
            (rb,rm) = sp.call(abi.encodeWithSignature("withdrawETHGainToTrove(address)", address(this)));
            assert(rb);

            // post conditions
            deposited = StabilityPool(payable(sp)).getDepositorETHGain(address(this));
            assert(deposited == 0);

        }

	function withdrawColl_should_revert_if_trove_is_not_active(uint256 col) public {
            checkInvariants(); 
            bool rb = true;
            bytes memory rm;


            if (BorrowerOperations(bo).troveManager().getTroveStatus(address(this)) == 1) {

                uint colBefore;
                (,colBefore,,,) = TroveManager(address(BorrowerOperations(bo).troveManager())).Troves(address(this));
                (rb,rm) = bo.call(abi.encodeWithSignature("withdrawColl(uint256,address)", colBefore+1, address(this)));
                assert(!rb);
                return; 

            }
        
            (rb,rm) = bo.call(abi.encodeWithSignature("withdrawColl(uint256,address)", col, address(this)));
            assert(!rb);
        }

	function withdrawColl_should_revert_if_recovery_mode_is_active(uint256 col) public {
            checkInvariants(); 
            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();

            if (!BorrowerOperations(bo).troveManager().checkRecoveryMode(price))
                return; 
        
            bool rb = true;
            bytes memory rm;

            (rb,rm) = bo.call(abi.encodeWithSignature("withdrawColl(uint256,address)", col, address(this)));
            assert(!rb);
        }

	/* This test is disabled until AccessControlTest.js is modify to deploy HintHelper
         function redeemCollateral_should_not_revert() public {
            checkInvariants(); 
            uint tokens = BorrowerOperations(bo).lusdToken().balanceOf(address(this));
            require(tokens >= 1e18); // no less than 1 LUSD
            require(ISortedTroves(st).getSize() >= 2);

            uint price = BorrowerOperations(bo).priceFeed().fetchPrice();
            require(price >= 10e18);

            bool rb = true;
            bytes memory rm;

            address frh;
            uint prhi;
            (frh, prhi) = HintHelpers(hh).getRedemptionHints(tokens, price);

            address prh; 
            (prh,) = ISortedTroves(st).findInsertPosition(prhi, price, address(this), address(this));
            (rb,rm) = address(BorrowerOperations(bo).troveManager()).call(abi.encodeWithSignature("redeemCollateral(uint256,address,address,uint256,uint256)", tokens, frh, prh, prhi, 3));
            assert(rb);
        }*/

        receive() external payable {
            if (msg.sender == address(0x111)) // We do not want ether from the other account
              revert();
        }

}

