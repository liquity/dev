pragma solidity ^0.5.11;

// TODO: Use SafeMath
import "./ICDPManager.sol";
import "./ICLVToken.sol";
import "./IPriceFeed.sol";
import "./ISortedCDPs.sol";
import "./IPoolManager.sol";
import "./DeciMath.sol";
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";

contract CDPManager is Ownable, ICDPManager {
    using SafeMath for uint;

    string public name;
    uint constant DIGITS = 1e18; // Number of digits used for precision, e.g. when calculating redistribution shares. Equals "ether" unit.
    uint constant MCR = (11 * DIGITS) / 10; // Minimal collateral ratio (e.g. 110%). TODO: Allow variable MCR
    uint constant MAX_DRAWDOWN = 20; // Loans cannot be drawn down more than 5% (= 1/20) below the TCR when receiving redistribution shares
    enum Status { nonExistent, newBorn, active, closed }
    
    // --- Events --- 
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address _user, uint arrayIndex);
    event CDPUpdated(address _user, uint _debt, uint _coll,  uint stake, uint arrayIndex);
    event CDPClosed(address _user);

    event CollateralAdded(address _user, uint _amountAdded);
    event CollateralWithdrawn(address _user, uint _amountWithdrawn);
    event CLVWithdrawn(address _user, uint _amountWithdrawn);
    event CLVRepayed(address _user, uint _amountRepayed);
    event CollateralRedeemed(address _user, uint exchangedCLV, uint redeemedETH);

    // --- Connected contract declarations ---
    IPoolManager poolManager;
    address public poolManagerAddress;

    ICLVToken CLV; 
    address public clvTokenAddress;

    IPriceFeed priceFeed;
    address public priceFeedAddress;

    // A doubly linked list of CDPs, sorted by their sorted by their collateral ratios
    ISortedCDPs sortedCDPs;
    address public sortedCDPsAddress;

    // --- Data structures ---

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

    // maps addresses with active CDPs to their RewardSnapshot
    mapping (address => RewardSnapshot) public rewardSnapshots;  

    // object containing the ETH and CLV snapshots for a given active CDP
    struct RewardSnapshot { uint ETH; uint CLVDebt;}   

    
    //array of all active CDP addresses - used to compute “approx hint” for list insertion
    address[] CDPOwners;

     // --- Modifiers ---
    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "ActivePool: Only the poolManager is authorized");
        _;
    }

    // --- Contract setters --- 
    function setPoolManager(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setCLVToken(address _clvTokenAddress) public onlyOwner {
        clvTokenAddress = _clvTokenAddress;
        CLV = ICLVToken(_clvTokenAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) public onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        sortedCDPs.setMaxSize(1000000);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Getters ---
    function getMCR() public pure returns(uint) {
        return MCR;
    }

    function getCDPOwnersCount() public view returns(uint) {
        return CDPOwners.length;
    }
    function getAccurateMulDiv(uint x, uint y, uint z) public pure returns(uint) {
        return DeciMath.accurateMulDiv(x, y, z);
    }
    
    /* --- SortedDoublyLinkedList (SDLL) getters and checkers. These enable public usage
    of the corresponding sortedCDPs functions --- */

    function sortedCDPsContains(address id) public view returns(bool) {
        return sortedCDPs.contains(id);
    }

    function sortedCDPsIsEmpty() public view returns (bool) {
        return sortedCDPs.isEmpty();
    }

    function sortedCDPsIsFull() public view returns(bool) {
        return sortedCDPs.isFull();
    }

    function sortedCDPsgetSize() public view returns(uint) {
        return sortedCDPs.getSize();
    }

    function sortedCDPsGetMaxSize() public view returns(uint) {
        return sortedCDPs.getMaxSize();
    }

    function sortedCDPsGetFirst() public view returns(address) {
        return sortedCDPs.getFirst();
    }

    function sortedCDPsGetLast() public view returns(address) {
        return sortedCDPs.getLast();
    }

    function sortedCDPsGetNext(address user) public view returns(address) {
        return sortedCDPs.getNext(user);
    }

    function sortedCDPsGetPrev(address user) public view returns(address) {
        return sortedCDPs.getPrev(user);
    }

    // --- CDP Operations ---

    // User-facing CDP creation
    function userCreateCDP() public returns (bool) 
    {
        address user = _msgSender();
        createCDP(user);

        return true;
    }

    function createCDP(address _user) internal returns (bool) 
    {
        require(CDPs[_user].status == Status.nonExistent, "CDPManager: CDP already exists");
        CDPs[_user].status = Status.newBorn; 
        
        /* push the owner's address to the CDP owners list - and record 
        the corresponding array index on the CDP struct */
        CDPs[_user].arrayIndex = CDPOwners.push(_user) - 1;  

        emit CDPCreated(_user, CDPs[_user].arrayIndex);
        return true;
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user) public payable returns (bool) 
    {
        bool isFirstCollDeposit = false;
        require(CDPs[_user].status != Status.closed, "CDPManager: CDP is closed");
        
        if (CDPs[_user].status == Status.nonExistent) {
            createCDP(_user);
            isFirstCollDeposit = true; 
        } else if (CDPs[_user].status == Status.newBorn) {
            isFirstCollDeposit = true;
        }
            
        CDPs[_user].status = Status.active;

        applyPendingRewards(_user);

        // Update the CDP's coll and stake
        CDPs[_user].coll = (CDPs[_user].coll).add(msg.value);
        updateStakeAndTotalStakes(_user);

        uint newICR = getCurrentICR(_user);

        // Insert CDP to sortedCDPs, or update exist CDP's position
        if (isFirstCollDeposit) {
            sortedCDPs.insert(_user, newICR, _user, _user);
        } else {
            sortedCDPs.reInsert(_user, newICR, _user, _user);
        }

        // Send the received collateral to PoolManager, to forward to ActivePool
        poolManager.addColl.value(msg.value)();

        emit CollateralAdded(_user, msg.value);
        emit CDPUpdated(_user, 
                        CDPs[_user].debt, 
                        CDPs[_user].coll, 
                        CDPs[_user].stake,
                        CDPs[_user].arrayIndex);
        return true;
    }
    
    // Withdraw ETH collateral from a CDP
    // TODO: Check re-entrancy protection
    function withdrawColl(uint _amount) public returns (bool) {
        address user = _msgSender();
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
       
        applyPendingRewards(user);
        require(CDPs[user].coll >= _amount, "CDPManager: Insufficient balance for ETH withdrawal");
        
        uint newICR = getNewICRfromCollDecrease(user, _amount);
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for ETH withdrawal");
        
        // Update the CDP's coll and stake
        CDPs[user].coll = (CDPs[user].coll).sub(_amount);
        
        updateStakeAndTotalStakes(user);

        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, user, user);
        
        // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);
        
        emit CollateralWithdrawn(user, _amount);
        emit CDPUpdated(user, 
                        CDPs[user].debt, 
                        CDPs[user].coll, 
                        CDPs[user].stake,
                        CDPs[user].arrayIndex); 
        return true;
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount) public returns (bool) {
        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Amount to withdraw must be larger than 0");
        
        uint newICR = getNewICRfromDebtIncrease(user, _amount);
        
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the CDP's debt
        CDPs[user].debt = (CDPs[user].debt).add(_amount);

        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, user, user);

        // Mint the given amount of CLV to the owner's address and add them to the ActivePool
        poolManager.withdrawCLV(user, _amount);
        
        emit CLVWithdrawn(user, _amount);
        emit CDPUpdated(user, 
                        CDPs[user].debt, 
                        CDPs[user].coll,  
                        CDPs[user].stake,
                        CDPs[user].arrayIndex); 
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount) public returns (bool) {
        address user = _msgSender();
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Repaid amount must be larger than 0");
       
        require(_amount <= CDPs[user].debt, "CDPManager: Repaid amount is larger than current debt");
        require(CLV.balanceOf(user) >= _amount, "CDPManager: Sender has insufficient CLV balance");
        // TODO: Maybe allow foreign accounts to repay loans
        
        // Update the CDP's debt
        CDPs[user].debt  = (CDPs[user].debt).sub(_amount);

        uint newICR = getCurrentICR(user);
        
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, user, user);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _amount);

        emit CLVRepayed(user, _amount);
        emit CDPUpdated(user, 
                        CDPs[user].debt, 
                        CDPs[user].coll, 
                        CDPs[user].stake,
                        CDPs[user].arrayIndex); 
        return true;
    }

    // --- CDP Liquidation functions ---

    // Closes the CDP of the specified user if its individual collateral ratio is lower than the minimum collateral ratio.
    // TODO: Left public for initial testing. Make internal.
    function liquidate(address _user) public returns (bool) {
        require(CDPs[_user].status == Status.active, "CDPManager: CDP does not exist or is already closed");
        
        // Apply any StabilityPool gains before checking ICR against MCR
        poolManager.withdrawFromSPtoCDP(_user);
        uint newICR = getCurrentICR(_user);

        // if newICR > MCR, update CDP's position in sortedCDPs and return
        if (newICR > MCR) { 
            // sortedCDPs.reInsert(_user, newICR, _user, _user);
            return false; 
        } 
        
        // Apply all the CDP's rewards before liquidation
        applyPendingRewards(_user);

        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
        uint CLVDebtRemainder = remainder[0];
        uint ETHRemainder = remainder[1];

        totalStakes = totalStakes.sub(CDPs[_user].stake);

        if (CLVDebtRemainder > 0) {
            if (totalStakes > 0) {
                /*If debt could not be offset entirely, add the coll and debt rewards-per-unit-staked 
                to the running totals. */
                uint ETHRewardPerUnitStaked = DeciMath.div_toDuint(ETHRemainder, totalStakes);
                uint CLVDebtRewardPerUnitStaked = DeciMath.div_toDuint(CLVDebtRemainder, totalStakes);
                
                L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
                L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
            }
            
            // Transfer coll and debt from ActivePool to DefaultPool
            poolManager.liquidate(CLVDebtRemainder, ETHRemainder);
        } 
        
        // Close the CDP
        CDPs[_user].status = Status.closed;

        // Update the snapshots of system stakes & system collateral
        totalStakesSnapshot = totalStakes;

        /* The total collateral snapshot is the sum of all active collateral and all pending rewards
       (ActivePool ETH + DefaultPool ETH), immediately after the liquidation occurs. */
        uint activeColl = poolManager.getActiveColl();
        uint liquidatedColl = poolManager.getLiquidatedColl();
        totalCollateralSnapshot = activeColl.add(liquidatedColl);
        
        // Remove CDP from sortedCDPs, and owner address from the CDPOwner array
        sortedCDPs.remove(_user);
        removeCDPOwner(_user);

        emit CDPClosed(_user);
        return true;
    }
     
    // Closes a maximum number of n multiple under-collateralized CDPs, starting from the one with the lowest collateral ratio
    // TODO: Should  be synchronized with PriceFeed and called every time the price is updated
    function liquidateCDPs(uint n) public returns (bool) {    
        uint i;

        while (i < n) {
            address user = sortedCDPs.getLast();
            uint collRatio = getCurrentICR(user);

            // Close CDPs if it is under-collateralized
            if (collRatio < MCR) {
                liquidate(user);
            } else break;
            
            // Break loop if you reach the first CDP in the sorted list 
            if (user == sortedCDPs.getFirst()) 
                break;
            
            i++;
        }       
        return true;
     }
            
    /* Send _amount CLV to the system and redeem the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
     request.  Applies pending rewards to a CDP before reducing its debt and coll.
    
    Note that if _amount is very large, this function can run out of gas. This can be easily avoided by splitting the total _amount
    in appropriate chunks and calling the function multiple times.
    
    TODO: Maybe also use the default pool for redemptions
    TODO: Levy a redemption fee (and maybe also impose a rate limit on redemptions) */
    function redeemCollateral(uint _CLVamount) public returns (bool) {
        address user = _msgSender();
        require(CLV.balanceOf(user) >= _CLVamount, "CDPManager: Sender has insufficient balance");
        uint exchangedCLV;
        uint redeemedETH;

        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (exchangedCLV < _CLVamount) {

            address currentCDPuser = sortedCDPs.getLast();
            uint collRatio = getCurrentICR(currentCDPuser);
            uint price = priceFeed.getPrice();
            uint activeDebt = poolManager.getActiveDebt();

            // Break the loop if there is no more active debt to cancel with the received CLV
            if (activeDebt == 0) break;   
            
            // Close CDPs along the way that turn out to be under-collateralized
            if (collRatio < MCR) {
                liquidate(currentCDPuser);
            }
            else {
                applyPendingRewards(currentCDPuser);

                // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the current CDP 
                uint CLVLot = getMin(_CLVamount.sub(exchangedCLV), CDPs[currentCDPuser].debt);
                uint ETHLot = DeciMath.accurateMulDiv(CLVLot, DIGITS, price);
                    
                // Decrease the debt and collateral of the current CDP according to the lot and corresponding ETH to send
                CDPs[currentCDPuser].debt = (CDPs[currentCDPuser].debt).sub(CLVLot);
                CDPs[currentCDPuser].coll = (CDPs[currentCDPuser].coll).sub(ETHLot);
                
                uint newCollRatio = getCurrentICR(currentCDPuser);

                // Burn the calculated lot of CLV and send the corresponding ETH to _msgSender()
                poolManager.redeemCollateral(user, CLVLot, ETHLot);

                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.reInsert(currentCDPuser, newCollRatio, user, user); 
                emit CDPUpdated(
                                currentCDPuser, 
                                CDPs[currentCDPuser].debt, 
                                CDPs[currentCDPuser].coll, 
                                CDPs[currentCDPuser].stake,
                                CDPs[currentCDPuser].arrayIndex);
                exchangedCLV = exchangedCLV.add(CLVLot);  
                redeemedETH = redeemedETH.add(ETHLot);
            }
        }
        emit CollateralRedeemed(user, exchangedCLV, redeemedETH);
    } 

    // --- Helper functions ---

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
    function getApproxHint(uint CR, uint numTrials) public view returns(address) {
        require (CDPOwners.length >= 1, "CDPManager: sortedList must not be empty");
        uint closestICR = 0;
        address hintAddress = address(0);
        uint i = 1;

        while (i < numTrials) {
            uint arrayIndex = getRandomArrayIndex(block.timestamp.add(i), CDPOwners.length);
            address currentAddress = CDPOwners[arrayIndex];
            uint currentICR = getCurrentICR(currentAddress);

            // Update closest if current is closer 
            if ((currentICR <= CR) && (currentICR > closestICR)) {
                closestICR = currentICR;
                hintAddress = currentAddress;
            }
            i++;
        }
    return hintAddress;
    }

    // Convert input to pseudo-random uint in range [0, arrayLength - 1]
    function getRandomArrayIndex(uint input, uint _arrayLength) internal view returns(uint){
        uint randomIndex = uint256(keccak256(abi.encodePacked(input))) % (_arrayLength);
        return randomIndex;
   }

    // Return the current collateral ratio (ICR) of a given CDP. Takes pending coll/debt rewards into account.
    function getCurrentICR(address _user) public view returns(uint) {
    
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = (CDPs[_user].coll).add(pendingETHReward);
        uint currentCLVDebt = (CDPs[_user].debt).add(pendingCLVDebtReward);

        return computeICR(currentETH, currentCLVDebt);
    }

    /* Compute the new collateral ratio, considering the collateral to be removed. Takes pending coll/debt 
    rewards into account. */
    function getNewICRfromCollDecrease(address _user, uint _collDecrease) view internal returns(uint) {

        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = (CDPs[_user].coll).add(pendingETHReward);
        uint currentCLVDebt = (CDPs[_user].debt).add(pendingCLVDebtReward);

        uint newColl = currentETH.sub(_collDecrease);
        
        return computeICR(newColl, currentCLVDebt);
    }

    /* Compute the new collateral ratio, considering the debt to be added.
     Takes pending coll/debt rewards into account. */
    function getNewICRfromDebtIncrease(address _user, uint _debtIncrease) view internal returns(uint) {
        
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = (CDPs[_user].coll).add(pendingETHReward);
        uint currentCLVDebt = (CDPs[_user].debt).add(pendingCLVDebtReward);

        uint newCLVDebt = currentCLVDebt.add(_debtIncrease);

        return computeICR(currentETH, newCLVDebt);
    } 

    function computeICR(uint coll, uint debt) view internal returns(uint) {
        uint price = priceFeed.getPrice();
        // Check if the total debt is higher than 0, to avoid division by 0
        if (debt > 0) {
            uint newCollRatio = DeciMath.accurateMulDiv(coll, price, debt);
            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else {
            return 2**256 - 1; 
        }
    }

    // Add the user's coll and debt rewards earned from liquidations, to their CDP
    function applyPendingRewards(address _user) internal returns(bool) {
        require(CDPs[_user].status == Status.active, "CDPManager: user must have an active CDP");
        
        // Compute pending rewards
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        // Apply pending rewards
        CDPs[_user].coll = CDPs[_user].coll.add(pendingETHReward);
        CDPs[_user].debt = CDPs[_user].debt.add(pendingCLVDebtReward);

        // Tell PM to transfer from DefaultPool to ActivePool when user claims rewards.
        poolManager.applyPendingRewards(pendingCLVDebtReward, pendingETHReward);

        // Update user's reward snapshot to reflect current values
        rewardSnapshots[_user].ETH = L_ETH;
        rewardSnapshots[_user].CLVDebt = L_CLVDebt;
        return true;
    }

    // Get the user's pending accumulated ETH reward, earned by its stake
    function computePendingETHReward(address _user) internal view returns(uint) {
        uint stake = CDPs[_user].stake;
        uint snapshotETH = rewardSnapshots[_user].ETH;

        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH);
        uint pendingETHReward = DeciMath.mul_uintByDuint(stake, rewardPerUnitStaked);
        return pendingETHReward;
    }

     // Get the user's pending accumulated CLV reward, earned by its stake
    function computePendingCLVDebtReward(address _user) internal view returns(uint) {
        uint stake =  CDPs[_user].stake;
        uint snapshotETH = rewardSnapshots[_user].CLVDebt;

        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotETH);
        uint pendingCLVDebtReward = DeciMath.mul_uintByDuint(stake, rewardPerUnitStaked);
        return pendingCLVDebtReward;
    }

    // Update user's stake based on their latest collateral value
    function updateStakeAndTotalStakes(address _user) internal returns(bool) {
        uint oldStake = CDPs[_user].stake;
        totalStakes = totalStakes.sub(oldStake);
       
        uint newStake = computeNewStake(CDPs[_user].coll);

        CDPs[_user].stake = newStake;
        totalStakes = totalStakes.add(newStake);
        return true;
    }

    function computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            uint ratio = DeciMath.div_toDuint(totalStakesSnapshot, totalCollateralSnapshot);
            stake = DeciMath.mul_uintByDuint(_coll, ratio);
        }
     return stake;
    }

    // Return the lower value from two given integers
    function getMin(uint a, uint b) internal pure returns (uint)
    {
        if (a <= b) return a;
        else return b;
    }    
    
     /* Remove a CDP owner from the CDPOwners array, preserving array length but not order. Deleting owner 'B' does the following: 
    [A B C D E] => [A E C D], and updates E's CDP struct to point to its new array index. */
    function removeCDPOwner(address _user) internal returns(bool) {
        require(CDPs[_user].status == Status.closed, "CDPManager: CDP is still active");

        uint index = CDPs[_user].arrayIndex;   
        address addressToMove = CDPOwners[CDPOwners.length - 1];
       
        CDPOwners[index] = addressToMove;   
        CDPs[addressToMove].arrayIndex = index;   
        CDPOwners.length--;  
    }

    /* --- MockAddCDP - DELETE AFTER CDP FUNCTIONALITY IMPLEMENTED --- *
    * temporary function, used by CLVToken test suite to easily add CDPs.
    Later, replace with full CDP creation process.
    */
    function mockAddCDP() public returns(bool) {
        CDP memory cdp;
        cdp.coll = 10e18;
        cdp.debt = 0;
        cdp.status = Status.active;

        CDPs[_msgSender()] = cdp;
    }
}