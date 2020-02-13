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
    uint constant MCR = 1100000000000000000; // Minimal collateral ratio.
    uint constant CCR = 1500000000000000000; // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant MAX_DRAWDOWN = 20; // Loans cannot be drawn down more than 5% (= 1/20) below the TCR when receiving redistribution shares
    uint constant MIN_COLL_IN_USD = 20000000000000000000;
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
    
    bool public recoveryMode;

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
        require(_msgSender() == poolManagerAddress, "CDPManager: Only the poolManager is authorized");
        _;
    }

    // modifier onlyPriceFeed {
    //     require(_msgSender() == priceFeedAddress, "CDPManager: Only the PriceFeed is authorized");
    //     _;
    // }

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
        require(CDPs[_user].status == Status.nonExistent || CDPs[_user].status == Status.closed, "CDPManager: CDP must be closed or non-existent");
        CDPs[_user].status = Status.newBorn; 
        
        /* push the owner's address to the CDP owners list - and record 
        the corresponding array index on the CDP struct */
        CDPs[_user].arrayIndex = CDPOwners.push(_user) - 1;  

        emit CDPCreated(_user, CDPs[_user].arrayIndex);
        return true;
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) public payable returns (bool) {
        bool isFirstCollDeposit = false;
        if (CDPs[_user].status == Status.nonExistent || CDPs[_user].status == Status.closed ) {
            createCDP(_user);
            isFirstCollDeposit = true; 
        } else if (CDPs[_user].status == Status.newBorn) {
            isFirstCollDeposit = true;
        }

        if (isFirstCollDeposit) {
            require(getUSDValue(msg.value) >= MIN_COLL_IN_USD, "CDPManager: Dollar value of collateral deposit must equal or exceed the minimum");
        }

        CDPs[_user].status = Status.active;

        applyPendingRewards(_user);

        // Update the CDP's coll and stake
        CDPs[_user].coll = (CDPs[_user].coll).add(msg.value);
        updateStakeAndTotalStakes(_user);

        uint newICR = getCurrentICR(_user);

        // Insert CDP to sortedCDPs, or update exist CDP's position
        if (isFirstCollDeposit) {
            sortedCDPs.insert(_user, newICR, _hint, _hint);
        } else {
            sortedCDPs.reInsert(_user, newICR, _hint, _hint);
        }

        // Send the received collateral to PoolManager, to forward to ActivePool
        poolManager.addColl.value(msg.value)();

        checkTCRAndSetRecoveryMode();
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
    function withdrawColl(uint _amount, address _hint) public returns (bool) {
        checkTCRAndSetRecoveryMode();

        address user = _msgSender();
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
       
        applyPendingRewards(user);
        require(CDPs[user].coll >= _amount, "CDPManager: Insufficient balance for ETH withdrawal");
        
        uint newColl = CDPs[user].coll.sub(_amount);
        require(getUSDValue(newColl) >= MIN_COLL_IN_USD  || newColl == 0, 
                "CDPManager: Remaining collateral must have $USD value >= 20, or be zero");

        uint newICR = getNewICRfromCollDecrease(user, _amount);
        require(recoveryMode == false, "CDPManager: Collateral withdrawal is not permitted during Recovery Mode");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for ETH withdrawal");
        
        // Update the CDP's coll and stake
        CDPs[user].coll = newColl;
        updateStakeAndTotalStakes(user);

        if (newColl == 0) { 
             closeCDP(user); 
        }  else { 
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, _hint, _hint);

        emit CollateralWithdrawn(user, _amount);
        emit CDPUpdated(user, 
                        CDPs[user].debt, 
                        CDPs[user].coll, 
                        CDPs[user].stake,
                        CDPs[user].arrayIndex); 
        }
         // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);

        return true;
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) public returns (bool) {
        checkTCRAndSetRecoveryMode();

        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Amount to withdraw must be larger than 0");
        
        uint newTCR = getNewTCRfromDebtIncrease(_amount);
        uint newICR = getNewICRfromDebtIncrease(user, _amount);
        
        require(recoveryMode == false, "CDPManager: Debt issuance is not permitted during Recovery Mode");
        require(newTCR >= CCR, "CDPManager: a CLV withdrawal that would result in TCR < CCR is not permitted");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the CDP's debt
        CDPs[user].debt = (CDPs[user].debt).add(_amount);

        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, _hint, _hint);

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
    function repayCLV(uint _amount, address _hint) public returns (bool) {

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
        sortedCDPs.reInsert(user, newICR, _hint, _hint);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _amount);

        checkTCRAndSetRecoveryMode();

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
        checkTCRAndSetRecoveryMode();

        require(CDPs[_user].status == Status.active, "CDPManager: CDP does not exist or is already closed");
        
        // Apply any StabilityPool gains before checking ICR against MCR
        poolManager.withdrawFromSPtoCDP(_user);
        uint ICR = getCurrentICR(_user);
        
        if (recoveryMode == true) {
            liquidateRecoveryMode(_user, ICR);
        } else if (recoveryMode == false) {
            liquidateNormalMode(_user, ICR);
        }  
    }
    
    function liquidateNormalMode(address _user, uint _ICR) internal returns (bool) {
        // if newICR > MCR, update CDP's position in sortedCDPs and return
        if (_ICR > MCR) { 
            sortedCDPs.reInsert(_user, _ICR, _user, _user);
            return false; 
        } 
    
        // Apply the CDP's rewards and remove stake
        applyPendingRewards(_user);
        removeStake(_user);

        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
        uint CLVDebtRemainder = remainder[0];
        uint ETHRemainder = remainder[1];

        redistributeCollAndDebt(ETHRemainder, CLVDebtRemainder);
        
        closeCDP(_user);
        updateSystemSnapshots();
        return true;
    }

    function liquidateRecoveryMode(address _user, uint _ICR) internal returns (bool) {
        // If ICR <= 100%, redistribute the CDP across all active CDPs
        if (_ICR <= 1000000000000000000) {
            applyPendingRewards(_user);
            removeStake(_user);

            // Redistribute entire coll and debt 
            uint entireColl = CDPs[_user].coll;
            uint entireDebt = CDPs[_user].debt;
            redistributeCollAndDebt(entireColl, entireDebt);

            closeCDP(_user);
            updateSystemSnapshots();

        // if 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > 1000000000000000000) && (_ICR < MCR)) {
            applyPendingRewards(_user);
            removeStake(_user);
            
            // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
            uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
            uint CLVDebtRemainder = remainder[0];
            uint ETHRemainder = remainder[1];

            redistributeCollAndDebt(ETHRemainder, CLVDebtRemainder);
    
            closeCDP(_user);
            updateSystemSnapshots();

        // If CDP has the lowest ICR and there is CLV in the Stability Pool, only offset it as much as possible (no redistribution)
        } else if ((_user == sortedCDPs.getLast()) && (poolManager.getStabilityPoolCLV() != 0)) {
            applyPendingRewards(_user);
            removeStake(_user);

            // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
            uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);
            uint CLVDebtRemainder = remainder[0];
            uint ETHRemainder = remainder[1];

            // Close the CDP and update snapshots if the CDP was completely offset against CLV in Stability Pool
            if (CLVDebtRemainder == 0) {
                closeCDP(_user);
                updateSystemSnapshots();
            }

            // If loan can not be entirely offset, leave the CDP active, with a reduced coll and debt, and corresponding new stake.
            if (CLVDebtRemainder > 0) {
                /* Temporarily pull the coll and debt remainders from the Active Pool, in order to correctly update system snapshots.
                Then restore the coll and debt remainders to the Active Pool.  */
                poolManager.pullFromActivePool(CLVDebtRemainder, ETHRemainder);
                updateSystemSnapshots();
                poolManager.returnToActivePool(CLVDebtRemainder, ETHRemainder);

                // Give the loan a new reduced coll and debt, then update stake and totalStakes
                CDPs[_user].coll = ETHRemainder;
                CDPs[_user].debt = CLVDebtRemainder;
                updateStakeAndTotalStakes(_user);
               
                uint newICR = getCurrentICR(_user);
                // TODO: use getApproxHint() here? Analyze gas usage and find size of list at which getApproxHint() is a net gas-saver
                sortedCDPs.reInsert(_user, newICR, _user, _user);

                emit CDPUpdated(_user, 
                    CDPs[_user].debt, 
                    CDPs[_user].coll, 
                    CDPs[_user].stake,
                    CDPs[_user].arrayIndex);
            }
        } 

        checkTCRAndSetRecoveryMode();
    }

    // Closes a maximum number of n multiple under-collateralized CDPs, starting from the one with the lowest collateral ratio
    // TODO: Should  be synchronized with PriceFeed and called every time the price is updated
    function liquidateCDPs(uint n) public returns (bool) {    
        checkTCRAndSetRecoveryMode();

        if (recoveryMode == true) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                // attempt to close CDP
                liquidate(user);

                // Break loop if the system has left recovery mode, or loop reaches the first CDP in the sorted list 
                if ((recoveryMode == false) || (user == sortedCDPs.getFirst())) { break; }
                i++;
            }
        } else if (recoveryMode == false) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                uint collRatio = getCurrentICR(user);

                // Close CDPs if it is under-collateralized
                if (collRatio < MCR) {
                    liquidate(user);
                } else break;
                
                // Break loop if you reach the first CDP in the sorted list 
                if (user == sortedCDPs.getFirst()) { break ;}
                i++;
            }       
        }
         return true;
    }
            
    /* Send _amount CLV to the system and redeem the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
     request.  Applies pending rewards to a CDP before reducing its debt and coll.
    
    Note that if _amount is very large, this function can run out of gas. This can be easily avoided by splitting the total _amount
    in appropriate chunks and calling the function multiple times.
    
    TODO: Maybe also use the default pool for redemptions
    TODO: Levy a redemption fee (and maybe also impose a rate limit on redemptions) */
    function redeemCollateral(uint _CLVamount, address _hint) public returns (bool) {
        require(CLV.balanceOf(_msgSender()) >= _CLVamount, "CDPManager: Sender has insufficient balance");
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
                poolManager.redeemCollateral(_msgSender(), CLVLot, ETHLot);

                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.reInsert(currentCDPuser, newCollRatio, _hint, _hint); 
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
        emit CollateralRedeemed(_msgSender(), exchangedCLV, redeemedETH);
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
        address hintAddress = sortedCDPsGetLast();
        uint closestICR = getCurrentICR(hintAddress);
        uint diff = getAbsoluteDifference(CR, closestICR);
        uint i = 1;

        while (i < numTrials) {
            uint arrayIndex = getRandomArrayIndex(block.timestamp.add(i), CDPOwners.length);
            address currentAddress = CDPOwners[arrayIndex];
            uint currentICR = getCurrentICR(currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = getAbsoluteDifference(currentICR, CR);

            if (currentDiff < diff) {
                closestICR = currentICR;
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    return hintAddress;
}

    function getAbsoluteDifference (uint a, uint b) internal view returns (uint) {
        if (a >= b) {
            return a.sub(b);
        } else if (a < b) {
            return b.sub(a);
        }
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

    // Remove use's stake from the totalStakes sum, and set their stake to 0
    function removeStake(address _user) internal returns (bool) {
        uint stake = CDPs[_user].stake;
        totalStakes = totalStakes.sub(stake);
        CDPs[_user].stake = 0;
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

    function redistributeCollAndDebt(uint _coll, uint _debt) internal returns (bool) {
        if (_debt > 0) {
            if (totalStakes > 0) {
                /*If debt could not be offset entirely, add the coll and debt rewards-per-unit-staked 
                to the running totals. */
                uint ETHRewardPerUnitStaked = DeciMath.div_toDuint(_coll, totalStakes);
                uint CLVDebtRewardPerUnitStaked = DeciMath.div_toDuint(_debt, totalStakes);
                
                L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
                L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
            }
            
            // Transfer coll and debt from ActivePool to DefaultPool
            poolManager.liquidate(_debt, _coll);
        } 
    }

    function closeCDP(address _user) internal returns (bool) {
        CDPs[_user].status = Status.closed;
        
        sortedCDPs.remove(_user);
        removeCDPOwner(_user);

        emit CDPClosed(_user);
        return true;
    }

    // Update the snapshots of system stakes & system collateral
    function updateSystemSnapshots() internal returns (bool) {
        totalStakesSnapshot = totalStakes;

        /* The total collateral snapshot is the sum of all active collateral and all pending rewards
       (ActivePool ETH + DefaultPool ETH), immediately after the liquidation occurs. */
        uint activeColl = poolManager.getActiveColl();
        uint liquidatedColl = poolManager.getLiquidatedColl();
        totalCollateralSnapshot = activeColl.add(liquidatedColl);

        return true;
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

    // Return the lower value from two given integers
    function getMin(uint a, uint b) internal pure returns (uint)
    {
        if (a <= b) return a;
        else return b;
    }  

    // Get the dollar value of collateral, as a duint
    function getUSDValue(uint _coll) internal view returns (uint) {
        return DeciMath.decMul(priceFeed.getPrice(), _coll);
    }

    function getNewTCRfromDebtIncrease(uint _debtIncrease) public view returns (uint) {
        uint activeColl = poolManager.getActiveColl();
        uint activeDebt = poolManager.getActiveDebt();
        uint liquidatedColl = poolManager.getLiquidatedColl();
        uint closedDebt = poolManager.getClosedDebt();

        uint totalCollateral = activeColl.add(liquidatedColl);
        uint newTotalDebt = activeDebt.add(closedDebt).add(_debtIncrease);

        uint newTCR = computeICR(totalCollateral, newTotalDebt);
        
        return newTCR;
    }

    function checkTCRAndSetRecoveryMode() public returns (bool){
        uint activeColl = poolManager.getActiveColl();
        uint activeDebt = poolManager.getActiveDebt();
        uint liquidatedColl = poolManager.getLiquidatedColl();
        uint closedDebt = poolManager.getClosedDebt();

        uint totalCollateral  = activeColl.add(liquidatedColl);
        uint totalDebt = activeDebt.add(closedDebt);

        uint TCR = computeICR(totalCollateral, totalDebt);
        
        /* if TCR falls below 150%, trigger recovery mode. If TCR rises above 150%, 
        disable recovery mode */
        if ((TCR < 1500000000000000000) && (recoveryMode == false)) {
            recoveryMode = true;
        } else if ((TCR >= 1500000000000000000) && (recoveryMode == true)) {
            recoveryMode = false;
        }

        return true;
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