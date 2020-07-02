pragma solidity 0.5.16;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
import "./Math.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/ReentrancyGuard.sol";
import "./Dependencies/console.sol";

contract CDPManager is ReentrancyGuard, Ownable, ICDPManager {
    using SafeMath for uint;

    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.
    uint constant public  CCR = 1500000000000000000; // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    
    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IPoolManager public poolManager;
    address public poolManagerAddress;

    IPool public activePool;
    address public activePoolAddress;

    IPool public defaultPool;
    address public defaultPoolAddress;

    ICLVToken public clvToken;
    address public clvTokenAddress;

    IPriceFeed public priceFeed;
    address public priceFeedAddress;

    IStabilityPool public stabilityPool;
    address public stabilityPoolAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs public sortedCDPs;
    address public sortedCDPsAddress;

    // --- Data structures ---

    enum Status { nonExistent, active, closed }

    // Store the necessary data for a Collateralized Debt Position (CDP)
    struct CDP {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint arrayIndex;
    }

    mapping (address => CDP) public CDPs;

    uint public totalStakes; 

    // snapshot of the value of totalStakes immediately after the last liquidation
    uint public totalStakesSnapshot;  

    // snapshot of the total collateral in ActivePool and DefaultPool, immediately after the last liquidation.
    uint public totalCollateralSnapshot;    

    /* L_ETH and L_CLVDebt track the sums of accumulated liquidation rewards per unit staked. During it's lifetime, each stake earns:

    An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    A CLVDebt gain  of ( stake * [L_CLVDebt - L_CLVDebt(0)] )
    
    Where L_ETH(0) and L_CLVDebt(0) are snapshots of L_ETH and L_CLVDebt for the active CDP taken at the instant the stake was made */
    uint public L_ETH;     
    uint public L_CLVDebt;    

    // Map addresses with active CDPs to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;  

    // Object containing the ETH and CLV snapshots for a given active CDP
    struct RewardSnapshot { uint ETH; uint CLVDebt;}   

    // Array of all active CDP addresses - used to compute “approx hint” for list insertion
    address[] public CDPOwners;

    // Error trackers for the trove redistribution calculation
    uint public lastETHError_Redistribution;
    uint public lastCLVDebtError_Redistribution;

     // --- Events --- 

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);
    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake);

    // --- Modifiers ---

    modifier onlyBorrowerOperations() {
        require(_msgSender() == borrowerOperationsAddress, "CDPManager: Caller is not the BorrowerOperations contract");
        _;
    }

    // --- Dependency setters --- 

    function setBorrowerOperations(address _borrowerOperationsAddress) external onlyOwner {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
    }
    
    function setPoolManager(address _poolManagerAddress) external onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setActivePool(address _activePoolAddress) external onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) external onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
    }

    function setStabilityPool(address _stabilityPoolAddress) external onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
    }

    function setPriceFeed(address _priceFeedAddress) external onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setCLVToken(address _clvTokenAddress) external onlyOwner {
        clvTokenAddress = _clvTokenAddress;
        clvToken = ICLVToken(_clvTokenAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) external onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Getters ---
    
    function getCDPOwnersCount() external view returns (uint) {
        return CDPOwners.length;
    }
    
    // --- CDP Liquidation functions ---

    // Closes the CDP of the specified user if its individual collateral ratio is lower than the minimum collateral ratio.
    function liquidate(address _user) external {
        uint price = priceFeed.getPrice();
        uint ICR = _getCurrentICR(_user, price);
        
        bool recoveryMode = _checkRecoveryMode();

        _requireCDPisActive(_user);

        if (recoveryMode == true) {
            _liquidateRecoveryMode(_user, ICR, price);
        } else if (recoveryMode == false) {
            _liquidateNormalMode(_user, ICR);
        }  
    }
   
    function _liquidateNormalMode(address _user, uint _ICR) internal {
        // If ICR >= MCR, or is last trove, don't liquidate 
        if (_ICR >= MCR || CDPOwners.length <= 1) { return; }
       
        // Get the CDP's entire debt and coll, including pending rewards from distributions
        (uint entireCDPDebt, uint entireCDPColl) = _getEntireDebtAndColl(_user);
        _removeStake(_user); 

        uint CLVInPool = stabilityPool.getCLV();

        // Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        if (CLVInPool > 0) {
            (uint CLVDebtRemainder, uint ETHRemainder) = poolManager.offset(entireCDPDebt, entireCDPColl, CLVInPool);
            _redistributeDebtAndColl(CLVDebtRemainder, ETHRemainder);
        } else {
            _redistributeDebtAndColl(entireCDPDebt, entireCDPColl);
        }

        _closeCDP(_user);
        _updateSystemSnapshots();
        emit CDPUpdated(_user, 0, 0, 0);
    }

    function _liquidateRecoveryMode(address _user, uint _ICR, uint _price) internal {
        // If is last trove, don't liquidate
        if (CDPOwners.length <= 1) { return; }

        // If ICR <= 100%, purely redistribute the CDP across all active CDPs
        if (_ICR <= 1000000000000000000) {
            (uint entireCDPDebt, uint entireCDPColl) = _getEntireDebtAndColl(_user);
            _removeStake(_user);
            
            _redistributeDebtAndColl(entireCDPDebt, entireCDPColl);

            _closeCDP(_user);
            _updateSystemSnapshots();

        // if 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > 1000000000000000000) && (_ICR < MCR)) {
            (uint entireCDPDebt, uint entireCDPColl) = _getEntireDebtAndColl(_user);
            _removeStake(_user);
            
            uint CLVInPool = stabilityPool.getCLV();

            if (CLVInPool > 0) {
                (uint CLVDebtRemainder, uint ETHRemainder) = poolManager.offset(entireCDPDebt, entireCDPColl, CLVInPool);
                _redistributeDebtAndColl(CLVDebtRemainder, ETHRemainder);
            } else {
                _redistributeDebtAndColl(entireCDPDebt, entireCDPColl);
            }
    
            _closeCDP(_user);
            _updateSystemSnapshots();

        // If CDP has the lowest ICR and there is CLV in the Stability Pool, only offset it as much as possible (no redistribution)
        } else if (_user == sortedCDPs.getLast()) {
            
            uint CLVInPool = stabilityPool.getCLV();
            if (CLVInPool == 0) { return; }

            _applyPendingRewards(_user);
            _removeStake(_user);

            (uint CLVDebtRemainder, uint ETHRemainder) = poolManager.offset(CDPs[_user].debt, 
                                                                            CDPs[_user].coll, 
                                                                            CLVInPool);
          
            // Close the CDP and update snapshots if the CDP was completely offset against CLV in Stability Pool
            if (CLVDebtRemainder == 0) {
                _closeCDP(_user);
                _updateSystemSnapshots();
            }

            // If loan can not be entirely offset, leave the CDP active, with a reduced coll and debt, and corresponding new stake.
            if (CLVDebtRemainder > 0) {
                // Update system snapshots, excluding the reduced collateral that remains in the CDP
                _updateSystemSnapshots_excludeCollRemainder(ETHRemainder);
                
                // Give the loan a new reduced coll and debt, then update stake and totalStakes
                CDPs[_user].coll = ETHRemainder;
                CDPs[_user].debt = CLVDebtRemainder;
                _updateStakeAndTotalStakes(_user);
               
                uint newICR = _getCurrentICR(_user, _price);
          
                sortedCDPs.reInsert(_user, newICR, _price, _user, _user); 
            }
        } 
        emit CDPUpdated(_user, 
                    CDPs[_user].debt, 
                    CDPs[_user].coll,
                    CDPs[_user].stake
                    );
    }

    // Closes a maximum number of n multiple under-collateralized CDPs, starting from the one with the lowest collateral ratio
    function liquidateCDPs(uint _n) external {  
        uint price = priceFeed.getPrice();
        bool recoveryModeAtStart = _checkRecoveryMode();

        if (recoveryModeAtStart == true) {
            uint i = 0;
            bool backToNormalMode =  false;

            while (i < _n) {
                address user = sortedCDPs.getLast();
                uint collRatio = _getCurrentICR(user, price);
                
                // Attempt to close CDP
                if (backToNormalMode == false) {
                    _liquidateRecoveryMode(user, collRatio, price);
                    backToNormalMode = !_checkRecoveryMode();
                } 
                else {
                    if (collRatio < MCR) {
                        _liquidateNormalMode(user, collRatio);
                    } else break;  // break if the loop reaches a CDP with ICR >= MCR
                } 
                // Break the loop if it reaches the first CDP in the sorted list 
                if (user == sortedCDPs.getFirst()) { break ;}
                i++;
            }

        } else if (recoveryModeAtStart == false) {
            uint i = 0;
            while (i < _n) {
                address user = sortedCDPs.getLast();
                uint collRatio = _getCurrentICR(user, price);

                // Close CDPs if it is under-collateralized
                if (collRatio < MCR) {
                    _liquidateNormalMode(user, collRatio);
                } else break;  // break if the loop reaches a CDP with ICR >= MCR
                
                // Break the loop if it reaches the first CDP in the sorted list 
                if (user == sortedCDPs.getFirst()) { break ;}
                i++;
            }       
        }
    }

    // Redeem as much collateral as possible from _cdpUser's CDP in exchange for CLV up to _maxCLVamount
    function _redeemCollateralFromCDP(
        address _cdpUser,
        uint _maxCLVamount,
        uint _price,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    )
        internal returns (uint)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the CDP
        uint CLVLot = Math._min(_maxCLVamount, CDPs[_cdpUser].debt); 
        
        // Pure division to integer
        uint ETHLot = CLVLot.mul(1e18).div(_price);
        
        // Decrease the debt and collateral of the current CDP according to the lot and corresponding ETH to send
        uint newDebt = (CDPs[_cdpUser].debt).sub(CLVLot);
        uint newColl = (CDPs[_cdpUser].coll).sub(ETHLot);

        if (newDebt == 0) {
            // No debt left in the CDP, therefore new ICR must be "infinite".
            // Passing zero as hint will cause sortedCDPs to descend the list from the head, which is the correct insert position.
            sortedCDPs.reInsert(_cdpUser, 2**256 - 1, _price, address(0), address(0)); 
        } else {
            uint newICR = Math._computeICR (newColl, newDebt, _price);

            // Check if the provided hint is fresh. If not, we bail since trying to reinsert without a good hint will almost
            // certainly result in running out of gas.
            if (newICR != _partialRedemptionHintICR) return 0;

            sortedCDPs.reInsert(_cdpUser, newICR, _price, _partialRedemptionHint, _partialRedemptionHint);
        }

        CDPs[_cdpUser].debt = newDebt;
        CDPs[_cdpUser].coll = newColl;
        _updateStakeAndTotalStakes(_cdpUser);

        // Burn the calculated lot of CLV and send the corresponding ETH to _msgSender()
        poolManager.redeemCollateral(_msgSender(), CLVLot, ETHLot); 

        emit CDPUpdated(
                        _cdpUser,
                        newDebt,
                        newColl,
                        CDPs[_cdpUser].stake
                        ); 

        return CLVLot;
    }

    function _isValidFirstRedemptionHint(address _firstRedemptionHint, uint _price) internal view returns (bool) {
        if (_firstRedemptionHint == address(0) ||
            !sortedCDPs.contains(_firstRedemptionHint) ||
            _getCurrentICR(_firstRedemptionHint, _price) < MCR
        ) {
            return false;
        }

        address nextCDP = sortedCDPs.getNext(_firstRedemptionHint);
        return nextCDP == address(0) || _getCurrentICR(nextCDP, _price) < MCR;
    }

    /* Send _CLVamount CLV to the system and redeem the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
     request.  Applies pending rewards to a CDP before reducing its debt and coll.

    Note that if _amount is very large, this function can run out of gas. This can be easily avoided by splitting the total _amount
    in appropriate chunks and calling the function multiple times.

    All CDPs that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be
    reinsterted at the top of the sortedCDPs list. If the last CDP does have some remaining debt, the reinsertion could be anywhere in the
    list, therefore it requires a hint. A frontend should use getRedemptionHints() to calculate what the ICR of this CDP will be
    after redemption, and pass a hint for its position in the sortedCDPs list along with the ICR value that the hint was found for.

    If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    is very likely that the last (partially) redeemed CDP would end up with a different ICR than what the hint is for. In this case the
    redemption will stop after the last completely redeemed CDP and the sender will keep the remaining CLV amount, which they can attempt
    to redeem later.
     */
    function redeemCollateral(
        uint _CLVamount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    )
    nonReentrant external
    {
        address redeemer = _msgSender();
        uint activeDebt = activePool.getCLVDebt();
        uint defaultedDebt = defaultPool.getCLVDebt();

        _requireCLVBalanceCoversRedemption(redeemer, _CLVamount);
        
        // Confirm redeemer's balance is less than total systemic debt
        assert(clvToken.balanceOf(redeemer) <= (activeDebt.add(defaultedDebt)));

        uint remainingCLV = _CLVamount;
        uint price = priceFeed.getPrice();
        address currentCDPuser;

        if (_isValidFirstRedemptionHint(_firstRedemptionHint, price)) {
            currentCDPuser = _firstRedemptionHint;
        } else {
            currentCDPuser = sortedCDPs.getLast();

            while (currentCDPuser != address(0) && _getCurrentICR(currentCDPuser, price) < MCR) {
                currentCDPuser = sortedCDPs.getPrev(currentCDPuser);
            }
        }

        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (currentCDPuser != address(0) && remainingCLV > 0) {
            // Save the address of the CDP preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedCDPs.getPrev(currentCDPuser);

            _applyPendingRewards(currentCDPuser);

            uint CLVLot = _redeemCollateralFromCDP(
                currentCDPuser,
                remainingCLV,
                price,
                _partialRedemptionHint,
                _partialRedemptionHintICR
            );

            if (CLVLot == 0) break; // Partial redemption hint got out-of-date, therefore we could not redeem from the last CDP

            remainingCLV = remainingCLV.sub(CLVLot);
            currentCDPuser = nextUserToCheck;
        }
    }

    // --- Helper functions ---

    /* getRedemptionHints() - Helper function for redeemCollateral().
     *
     * Find the first and last CDPs that will modified by calling redeemCollateral() with the same _CLVamount and _price,
     * and return the address of the first one and the final ICR of the last one.
     */
    function getRedemptionHints(uint _CLVamount, uint _price)
        external
        view
        returns (address firstRedemptionHint, uint partialRedemptionHintICR)
    {
        uint remainingCLV = _CLVamount;
        address currentCDPuser = sortedCDPs.getLast();

        while (currentCDPuser != address(0) && _getCurrentICR(currentCDPuser, _price) < MCR) {
            currentCDPuser = sortedCDPs.getPrev(currentCDPuser);
        }

        firstRedemptionHint = currentCDPuser;

        while (currentCDPuser != address(0) && remainingCLV > 0) {
            uint CLVDebt = CDPs[currentCDPuser].debt.add(_computePendingCLVDebtReward(currentCDPuser));

            if (CLVDebt > remainingCLV) {
                uint ETH = CDPs[currentCDPuser].coll.add(_computePendingETHReward(currentCDPuser));
                uint newDebt = CLVDebt.sub(remainingCLV);

                uint newColl = ETH.sub(remainingCLV.mul(1e18).div(_price));

                partialRedemptionHintICR = Math._computeICR (newColl, newDebt, _price);

                break;
            } else {
                remainingCLV = remainingCLV.sub(CLVDebt);
            }

            currentCDPuser = sortedCDPs.getPrev(currentCDPuser);
        }
    }

     /* getApproxHint() - return address of a CDP that is, on average, (length / numTrials) positions away in the 
    sortedCDPs list from the correct insert position of the CDP to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
   
    Note on the use of block.timestamp for random number generation: it is known to be gameable by miners. However, no value 
    transmission depends on getApproxHint() - it is only used to generate hints for efficient list traversal. In this case, 
    there is no profitable exploit.
    */
    function getApproxHint(uint _CR, uint _numTrials) external view returns (address) {
        require (CDPOwners.length >= 1, "CDPManager: sortedList must not be empty");
        uint price = priceFeed.getPrice();
        address hintAddress = sortedCDPs.getLast();
        uint closestICR = _getCurrentICR(hintAddress, price);
        uint diff = Math._getAbsoluteDifference(_CR, closestICR);
        uint i = 1;

        while (i < _numTrials) {
            uint arrayIndex = _getRandomArrayIndex(block.timestamp.add(i), CDPOwners.length);
            address currentAddress = CDPOwners[arrayIndex];
            uint currentICR = _getCurrentICR(currentAddress, price);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = Math._getAbsoluteDifference(currentICR, _CR);

            if (currentDiff < diff) {
                closestICR = currentICR;
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    return hintAddress;
}

    // Convert input to pseudo-random uint in range [0, arrayLength - 1]
    function _getRandomArrayIndex(uint _input, uint _arrayLength) internal pure returns (uint) {
        uint randomIndex = uint256(keccak256(abi.encodePacked(_input))) % (_arrayLength);
        return randomIndex;
   }

    function getCurrentICR(address _user, uint _price) external view returns (uint) {
        return _getCurrentICR(_user, _price);
    }

    // Return the current collateral ratio (ICR) of a given CDP. Takes pending coll/debt rewards into account.
    function _getCurrentICR(address _user, uint _price) internal view returns (uint) {
        uint pendingETHReward = _computePendingETHReward(_user); 
        uint pendingCLVDebtReward = _computePendingCLVDebtReward(_user); 
        
        uint currentETH = CDPs[_user].coll.add(pendingETHReward); 
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward); 
       
        uint ICR = Math._computeICR (currentETH, currentCLVDebt, _price);  
        return ICR;
    }

    function applyPendingRewards(address _user) external onlyBorrowerOperations {
        return _applyPendingRewards(_user);
    }

    // Add the user's coll and debt rewards earned from liquidations, to their CDP
    function _applyPendingRewards(address _user) internal {
        if (_hasPendingRewards(_user)) { 
        
            _requireCDPisActive(_user);

            // Compute pending rewards
            uint pendingETHReward = _computePendingETHReward(_user); 
            uint pendingCLVDebtReward = _computePendingCLVDebtReward(_user);  

            // Apply pending rewards
            CDPs[_user].coll = CDPs[_user].coll.add(pendingETHReward);  
            CDPs[_user].debt = CDPs[_user].debt.add(pendingCLVDebtReward); 

            _updateRewardSnapshots(_user);

            // Tell PM to transfer from DefaultPool to ActivePool when user claims rewards
            poolManager.moveDistributionRewardsToActivePool(pendingCLVDebtReward, pendingETHReward); 
        }
    }

    // Update user's snapshots of L_ETH and L_CLVDebt to reflect the current values
    function updateRewardSnapshots(address _user) external onlyBorrowerOperations {
       return  _updateRewardSnapshots(_user);
    }

    function _updateRewardSnapshots(address _user) internal {
        rewardSnapshots[_user].ETH = L_ETH; 
        rewardSnapshots[_user].CLVDebt = L_CLVDebt; 
    }
    
    function getPendingETHReward(address _user) external view returns (uint) {
        return _computePendingETHReward(_user);
    }

    // Get the user's pending accumulated ETH reward, earned by its stake
    function _computePendingETHReward(address _user) internal view returns (uint) {
        uint snapshotETH = rewardSnapshots[_user].ETH; 
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH); 
        
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        uint stake = CDPs[_user].stake;
        
        uint pendingETHReward = stake.mul(rewardPerUnitStaked).div(1e18);

        return pendingETHReward;
    }

    function getPendingCLVDebtReward(address _user) external view returns (uint) {
        return _computePendingCLVDebtReward(_user);
    }

     // Get the user's pending accumulated CLV reward, earned by its stake
    function _computePendingCLVDebtReward(address _user) internal view returns (uint) {
        uint snapshotCLVDebt = rewardSnapshots[_user].CLVDebt;  
        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt); 
       
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        uint stake =  CDPs[_user].stake; 
      
        uint pendingCLVDebtReward = stake.mul(rewardPerUnitStaked).div(1e18);
     
        return pendingCLVDebtReward;
    }

    function _hasPendingRewards(address _user) internal view returns (bool) {
        // A CDP has pending rewards if the current reward sum differs from the CDP's snapshot
        return (rewardSnapshots[_user].ETH != L_ETH);
    }

     /* Computes the CDPs entire debt and coll, including distribution pending rewards. Transfers any rewards 
    from Default Pool to Active Pool. */ 
    function _getEntireDebtAndColl(address _user) 
    internal 
    returns (uint debt, uint coll)
    {
        debt = CDPs[_user].debt;
        coll = CDPs[_user].coll;

        if (_hasPendingRewards(_user)) {
            uint pendingCLVDebtReward = _computePendingCLVDebtReward(_user);
            uint pendingETHReward = _computePendingETHReward(_user);

            debt = debt.add(pendingCLVDebtReward);
            coll = coll.add(pendingETHReward);

            poolManager.moveDistributionRewardsToActivePool(pendingCLVDebtReward, pendingETHReward); 
        }

        return (debt, coll);
    }

    function removeStake(address _user) external onlyBorrowerOperations {
        return _removeStake(_user);
    }

    // Remove use's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(address _user) internal {
        uint stake = CDPs[_user].stake;
        totalStakes = totalStakes.sub(stake);
        CDPs[_user].stake = 0;
    }

    function updateStakeAndTotalStakes(address _user) external onlyBorrowerOperations returns (uint) {
        return _updateStakeAndTotalStakes(_user);
    }

    // Update user's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(address _user) internal returns (uint) {
        uint newStake = _computeNewStake(CDPs[_user].coll); 
        uint oldStake = CDPs[_user].stake;
        CDPs[_user].stake = newStake;
        totalStakes = totalStakes.sub(oldStake).add(newStake);

        return newStake;
    }

    function _computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot);
        }
     return stake;
    }

    function _redistributeDebtAndColl(uint _debt, uint _coll) internal {
        if (_debt == 0) { return; }
        
        if (totalStakes > 0) {
            // Add distributed coll and debt rewards-per-unit-staked to the running totals.
            
            // Division with correction
            uint ETHNumerator = _coll.mul(1e18).add(lastETHError_Redistribution);
            uint CLVDebtNumerator = _debt.mul(1e18).add(lastCLVDebtError_Redistribution);

            uint ETHRewardPerUnitStaked = ETHNumerator.div(totalStakes);
            uint CLVDebtRewardPerUnitStaked = CLVDebtNumerator.div(totalStakes);

            lastETHError_Redistribution = ETHNumerator.sub(ETHRewardPerUnitStaked.mul(totalStakes));
            lastCLVDebtError_Redistribution = CLVDebtNumerator.sub(CLVDebtRewardPerUnitStaked.mul(totalStakes));

            L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
            L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
        }
        // Transfer coll and debt from ActivePool to DefaultPool
        poolManager.liquidate(_debt, _coll);
    }

    function closeCDP(address _user) external onlyBorrowerOperations {
        return _closeCDP(_user);
    }

    function _closeCDP(address _user) internal {
        CDPs[_user].status = Status.closed;
        CDPs[_user].coll = 0;
        CDPs[_user].debt = 0;
        
        rewardSnapshots[_user].ETH = 0;
        rewardSnapshots[_user].CLVDebt = 0;
 
        _removeCDPOwner(_user);
        sortedCDPs.remove(_user);
    }

    // Update the snapshots of system stakes & system collateral
    function _updateSystemSnapshots() internal {
        totalStakesSnapshot = totalStakes;

        /* The total collateral snapshot is the sum of all active collateral and all pending rewards
       (ActivePool ETH + DefaultPool ETH), immediately after the liquidation occurs. */
        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.add(liquidatedColl);
    }

    // Updates snapshots of system stakes and system collateral, excluding a given collateral remainder from the calculation
    function _updateSystemSnapshots_excludeCollRemainder(uint _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.sub(_collRemainder).add(liquidatedColl);
    }
  
    // Push the owner's address to the CDP owners list, and record the corresponding array index on the CDP struct
    function addCDPOwnerToArray(address _user) external onlyBorrowerOperations returns (uint index) {
        index = CDPOwners.push(_user).sub(1);
        CDPs[_user].arrayIndex = index;

        return index;
    }

     /* Remove a CDP owner from the CDPOwners array, not preserving order. Removing owner 'B' does the following: 
    [A B C D E] => [A E C D], and updates E's CDP struct to point to its new array index. */
    function _removeCDPOwner(address _user) internal {
        require(CDPs[_user].status == Status.closed, "CDPManager: CDP is still active");

        uint index = CDPs[_user].arrayIndex;   
        uint length = CDPOwners.length;
        uint idxLast = length.sub(1);

        assert(length >= 1);  // Encapsulating function should only be reachable when there are >0 troves in the system
        assert(index <= idxLast); 

        address addressToMove = CDPOwners[idxLast];
       
        CDPOwners[index] = addressToMove;   
        CDPs[addressToMove].arrayIndex = index;   
        CDPOwners.length--;  
    }
  
    function checkRecoveryMode() external view returns (bool){
        return _checkRecoveryMode();
    }

    function _checkRecoveryMode() internal view returns (bool){
        uint price = priceFeed.getPrice();

        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLVDebt();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLVDebt();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt); 

        uint TCR = Math._computeICR (totalCollateral, totalDebt, price); 
        
        if (TCR < CCR) {
            return true;
        } else {
            return false;
        }
    }

    function _requireCDPisActive(address _user) internal view {
        require(CDPs[_user].status == Status.active, "CDPManager: Trove does not exist or is closed");
    }

    function _requireCLVBalanceCoversRedemption(address _user, uint _amount) internal view {
        require(clvToken.balanceOf(_user) >= _amount, "CDPManager: Requested redemption amount must be >= user's CLV token balance");
    }

    // --- Trove property getters ---

    function getCDPStatus(address _user) external view returns (uint) {
        return uint(CDPs[_user].status);
    }

    function getCDPStake(address _user) external view returns (uint) {
        return CDPs[_user].stake;
    }

    function getCDPDebt(address _user) external view returns (uint) {
        return CDPs[_user].debt;
    }

    function getCDPColl(address _user) external view returns (uint) {
        return CDPs[_user].coll;
    }

    // --- Trove property setters --- 

    function setCDPStatus(address _user, uint _num) external onlyBorrowerOperations {
        CDPs[_user].status = Status(_num);
    }

    function increaseCDPColl(address _user, uint _collIncrease) external onlyBorrowerOperations returns (uint) {
        uint newColl = CDPs[_user].coll.add(_collIncrease);
        CDPs[_user].coll = newColl;
        return newColl;
    }

    function decreaseCDPColl(address _user, uint _collDecrease) external onlyBorrowerOperations returns (uint) {
        uint newColl = CDPs[_user].coll.sub(_collDecrease);
        CDPs[_user].coll = newColl;
        return newColl;
    }

    function increaseCDPDebt(address _user, uint _debtIncrease) external onlyBorrowerOperations returns (uint) {
        uint newDebt = CDPs[_user].debt.add(_debtIncrease);
        CDPs[_user].debt = newDebt;
        return newDebt;
    }

    function decreaseCDPDebt(address _user, uint _debtDecrease) external onlyBorrowerOperations returns (uint) {
        uint newDebt = CDPs[_user].debt.sub(_debtDecrease);
        CDPs[_user].debt = newDebt;
        return newDebt;
    }
}