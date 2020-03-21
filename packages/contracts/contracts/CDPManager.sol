pragma solidity ^0.5.11;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPool.sol";
import "./Interfaces/ICLVToken.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Interfaces/IPoolManager.sol";
import "./DeciMath.sol";
import "./ABDKMath64x64.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

contract CDPManager is Ownable, ICDPManager {
    using SafeMath for uint;

    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.
    uint constant public  CCR = 1500000000000000000; // Critical system collateral ratio. If the total system collateral (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public MIN_COLL_IN_USD = 20000000000000000000;
    enum Status { nonExistent, active, closed }
    
    // --- Events --- 
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);

    event CDPCreated(address indexed _user, uint arrayIndex);
    event CDPUpdated(address indexed _user, uint _debt, uint _coll, uint stake);
   
    // --- Connected contract declarations ---
    IPoolManager poolManager;
    address public poolManagerAddress;

    IPool activePool;
    address public activePoolAddress;

    IPool defaultPool;
    address public defaultPoolAddress;

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

    // --- Dependency setters --- 

    function setPoolManager(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = IPoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setActivePool(address _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(_activePoolAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
    }

    function setDefaultPool(address _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(_defaultPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
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
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    // --- Getters ---
    
    function getCDPOwnersCount() public view returns(uint) {
        return CDPOwners.length;
    }
    
    // --- CDP Operations ---

    function openLoan(uint _CLVAmount, address _hint) public payable returns (bool) {
        uint price = priceFeed.getPrice(); 
        bool recoveryMode = checkTCRAndSetRecoveryMode(price); 
        
        address user = _msgSender(); 
       
        require(CDPs[user].status != Status.active, "CDPManager: Borrower already has an active CDP"); 
        require(recoveryMode == false || _CLVAmount == 0, "CDPManager: Debt issuance is not permitted during Recovery Mode"); // 840 gas
        
        require(getUSDValue(msg.value, price) >= MIN_COLL_IN_USD, 
                "CDPManager: Dollar value of collateral deposit must equal or exceed the minimum");  
       
        uint ICR = computeICR(msg.value, _CLVAmount, price);  
        require(ICR >= MCR, "CDPManager: ICR of prospective loan must be >= than the MCR"); 
      
        uint newTCR = getNewTCR(msg.value, _CLVAmount, price);  
        require (newTCR >= CCR, "CDPManager: opening a loan that would result in a TCR < CCR is not permitted");  // 10 gas
       
        // Update loan properties
        CDPs[user].status = Status.active;  // 21000 gas
        CDPs[user].coll = msg.value;  // 20100 gas
        CDPs[user].debt = _CLVAmount; // 20100 gas
       
        updateRewardSnapshots(user); // 3300 gas
        updateStakeAndTotalStakes(user); // 30500 gas
        
        sortedCDPs.insert(user, ICR, price, _hint, _hint); // 94000 gas
        
        /* push the owner's address to the CDP owners list, and record 
        the corresponding array index on the CDP struct */
        CDPs[user].arrayIndex = CDPOwners.push(user) - 1; // 46800 gas
        
        // Move the ether to the activePool, and mint CLV to the borrower
        poolManager.addColl.value(msg.value)(); // 25500 gas
    
        poolManager.withdrawCLV(user, _CLVAmount); // 50500 gas
       
        checkTCRAndSetRecoveryMode(price); // 26500 gas
        emit CDPUpdated(user, 
                        _CLVAmount, 
                        msg.value,
                        CDPs[user].stake
                        ); 
        return true;
    }

    // Send ETH as collateral to a CDP
    function addColl(address _user, address _hint) public payable returns (bool) {
        bool isFirstCollDeposit;
        uint price = priceFeed.getPrice();
       
        Status status = CDPs[_user].status;
    
        if (status == Status.nonExistent || status == Status.closed ) {
            require(getUSDValue(msg.value, price) >= MIN_COLL_IN_USD, 
                    "CDPManager: Dollar value of collateral deposit must equal or exceed the minimum");
            isFirstCollDeposit = true; 
            CDPs[_user].status = Status.active;
        } 

        applyPendingRewards(_user);
       
        // Update the CDP's coll and stake
        uint newColl = (CDPs[_user].coll).add(msg.value);
        CDPs[_user].coll = newColl;

        updateStakeAndTotalStakes(_user);
        
        uint newICR = getCurrentICR(_user, price);
   
        if (isFirstCollDeposit) { 
            sortedCDPs.insert(_user, newICR, price, _hint, _hint);
             /* push the owner's address to the CDP owners list, and record 
            the corresponding array index on the CDP struct */
            CDPs[_user].arrayIndex = CDPOwners.push(_user) - 1;
            emit CDPCreated(_user, CDPs[_user].arrayIndex);
        } else {
            sortedCDPs.reInsert(_user, newICR, price, _hint, _hint);  
        }

        // Send the received collateral to PoolManager, to forward to ActivePool
        poolManager.addColl.value(msg.value)();
  
        checkTCRAndSetRecoveryMode(price);
        emit CDPUpdated(_user, 
                        CDPs[_user].debt, 
                        newColl,
                        CDPs[_user].stake
                        );
        return true;
    }
    
    // Withdraw ETH collateral from a CDP
    // TODO: Check re-entrancy protection
    function withdrawColl(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        checkTCRAndSetRecoveryMode(price);

        address user = _msgSender();
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
       
        applyPendingRewards(user);
        uint coll = CDPs[user].coll;
        require(coll >= _amount, "CDPManager: Insufficient balance for ETH withdrawal");
        
        uint newColl = coll.sub(_amount);
        require(getUSDValue(newColl, price) >= MIN_COLL_IN_USD  || newColl == 0, 
                "CDPManager: Remaining collateral must have $USD value >= 20, or be zero");

     
        uint newICR = getNewICRfromCollDecrease(user, _amount, price);  // 6100 gas

        require(recoveryMode == false, "CDPManager: Collateral withdrawal is not permitted during Recovery Mode");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for ETH withdrawal");
        
        // Update the CDP's coll and stake
        CDPs[user].coll = newColl;
        updateStakeAndTotalStakes(user);

        if (newColl == 0) { 
             closeCDP(user);  
        }  else { 
        // Update CDP's position in sortedCDPs
            sortedCDPs.reInsert(user, newICR, price, _hint, _hint);
            emit CDPUpdated(user, 
                            CDPs[user].debt, 
                            newColl,
                            CDPs[user].stake
                            ); 
        }
         // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);

        return true;
    }
    
    // Withdraw CLV tokens from a CDP: mint new CLV to the owner, and increase the debt accordingly
    function withdrawCLV(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Amount to withdraw must be larger than 0");
        
        applyPendingRewards(user);

        uint newTCR = getNewTCR(0, _amount, price);
        uint newICR = getNewICRfromDebtIncrease(user, _amount, price);
        
        require(recoveryMode == false, "CDPManager: Debt issuance is not permitted during Recovery Mode");
        require(newTCR >= CCR, "CDPManager: a CLV withdrawal that would result in TCR < CCR is not permitted");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the CDP's debt
        uint newDebt = (CDPs[user].debt).add(_amount);
        CDPs[user].debt = newDebt;

        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Mint the given amount of CLV to the owner's address and add them to the ActivePool
        poolManager.withdrawCLV(user, _amount);
        
        emit CDPUpdated(user, 
                        newDebt, 
                        CDPs[user].coll, 
                        CDPs[user].stake
                        ); 
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens, and reduce the debt accordingly
    function repayCLV(uint _amount, address _hint) public returns (bool) {
        uint price = priceFeed.getPrice();
        address user = _msgSender();
        
        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Repaid amount must be larger than 0");
       
       applyPendingRewards(user);

        uint debt = CDPs[user].debt;
        require(_amount <= debt, "CDPManager: Repaid amount is larger than current debt");
        // require(CLV.balanceOf(user) >= _amount, "CDPManager: Sender has insufficient CLV balance");
        // TODO: Maybe allow foreign accounts to repay loans
        
        // Update the CDP's debt
        uint newDebt = debt.sub(_amount);
        CDPs[user].debt  = newDebt;

        uint newICR = getCurrentICR(user, price);
        
        // Update CDP's position in sortedCDPs
        sortedCDPs.reInsert(user, newICR, price, _hint, _hint);

        // Burn the received amount of CLV from the user's balance, and remove it from the ActivePool
        poolManager.repayCLV(user, _amount);
        
        checkTCRAndSetRecoveryMode(price);
        emit CDPUpdated(user, 
                        newDebt, 
                        CDPs[user].coll,
                        CDPs[user].stake
                        ); 
        return true;
    }

    function closeLoan(uint _amount) public returns (bool) {
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);
        
        address user = _msgSender();
        applyPendingRewards(user);

        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        uint ICR = getCurrentICR(user, price);
        require (ICR < 100000000000000000000 || ICR >= MCR, "CDPManager: ICR must not be in liquidation range of 100-110%");
        
        require(recoveryMode == false, "CDPManager: Closing a loan is not permitted during Recovery Mode");
        
        uint coll = CDPs[user].coll;
        uint debt = CDPs[user].debt;
        require (_amount >= debt, "CDPManager: Received CLV must cover the CDP's outstanding debt");

        uint newTCR = getNewTCRFromDecrease(coll, debt, price);
        require (newTCR >= CCR, "CDPManager: Closing the loan must not pull TCR below CCR" );
        
        removeStake(user);
        closeCDP(user);
    
        // -Tell PM to burn _debt from the user's balance, and send the collateral back to the user
        poolManager.repayCLV(user, _amount);
        poolManager.withdrawColl(user, _amount);
    }

    // --- CDP Liquidation functions ---

    // Closes the CDP of the specified user if its individual collateral ratio is lower than the minimum collateral ratio.
    // TODO: Left public for initial testing. Make internal.
    function liquidate(address _user) public returns (bool) {
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        require(CDPs[_user].status == Status.active, "CDPManager: CDP does not exist or is already closed");
        
        if (recoveryMode == true) {
            liquidateRecoveryMode(_user, price);
        } else if (recoveryMode == false) {
            liquidateNormalMode(_user, price);
        }  
    }
   
    function liquidateNormalMode(address _user, uint price) internal returns (bool) {
        /* If ICR < MCR, check whether ETH gains from the Stability Pool would bring the ICR above the MCR.
        If so, don't liquidate */
        
        uint ICR = getNewICRFromPendingSPGain(_user, price);
        if (ICR > MCR) { return false; }
       
        // Apply the CDP's rewards and remove stake
        applyPendingRewards(_user); // 1800 gas 
        removeStake(_user); // 3600 gas
    
        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = poolManager.offset(CDPs[_user].debt, CDPs[_user].coll);  // 89500 gas
        uint CLVDebtRemainder = remainder[0];
        uint ETHRemainder = remainder[1];
       
        redistributeCollAndDebt(ETHRemainder, CLVDebtRemainder);
        closeCDP(_user); // 61000 gas
        updateSystemSnapshots(); // 23000 gas
        emit CDPUpdated(_user, 
                    0, 
                    0,
                    CDPs[_user].stake
                    );

        return true;
    }

    function liquidateRecoveryMode(address _user, uint price) internal returns (bool) {
        uint ICR = getNewICRFromPendingSPGain(_user, price);

        // If ICR <= 100%, redistribute the CDP across all active CDPs
        if (ICR <= 1000000000000000000) {
            applyPendingRewards(_user);
            removeStake(_user);

            // Redistribute entire coll and debt 
            uint entireColl = CDPs[_user].coll;
            uint entireDebt = CDPs[_user].debt;
            redistributeCollAndDebt(entireColl, entireDebt);

            closeCDP(_user);
            updateSystemSnapshots();

        // if 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((ICR > 1000000000000000000) && (ICR < MCR)) {
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
                // Update system snapshots, excluding the reduced collateral that remains in the CDP
                updateSystemSnapshots_excludeCollRemainder(ETHRemainder);
                
                // Give the loan a new reduced coll and debt, then update stake and totalStakes
                CDPs[_user].coll = ETHRemainder;
                CDPs[_user].debt = CLVDebtRemainder;
                updateStakeAndTotalStakes(_user);
               
                uint newICR = getCurrentICR(_user, price);
                // TODO: use getApproxHint() here? Analyze gas usage and find size of list at which getApproxHint() is a net gas-saver
                sortedCDPs.reInsert(_user, newICR, price, _user, _user); 
            }
        } 
        checkTCRAndSetRecoveryMode(price);
        emit CDPUpdated(_user, 
                    CDPs[_user].debt, 
                    CDPs[_user].coll,
                    CDPs[_user].stake
                    );
    }

    // Closes a maximum number of n multiple under-collateralized CDPs, starting from the one with the lowest collateral ratio
    // TODO: Should  be synchronized with PriceFeed and called every time the price is updated
    function liquidateCDPs(uint n) public returns (bool) {  
        uint price = priceFeed.getPrice();
        bool recoveryMode = checkTCRAndSetRecoveryMode(price);

        if (recoveryMode == true) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                uint collRatio = getCurrentICR(user, price);
                // attempt to close CDP
                liquidate(user);
                /* Break loop if the system has left recovery mode and all active CDPs are 
                above the MCR, or if the loop reaches the first CDP in the sorted list  */
                if ((recoveryMode == false && collRatio >= MCR) || (user == sortedCDPs.getFirst())) { break; }
                i++;
            }
            return true;

        } else if (recoveryMode == false) {
            uint i;
            while (i < n) {
                address user = sortedCDPs.getLast();
                uint collRatio = getCurrentICR(user, price);

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
     */
    function redeemCollateral(uint _CLVamount, address _hint) public returns (bool) {
        uint exchangedCLV;
        uint redeemedETH;
        uint price = priceFeed.getPrice(); // 3500 gas
        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (exchangedCLV < _CLVamount) {
            
            address currentCDPuser = sortedCDPs.getLast();  // 3500 gas (for 10 CDPs in list)
            // Break the loop if there is no more active debt to cancel with the received CLV
            // if (poolManager.getActiveDebt() == 0) break;
            if (activePool.getCLV() == 0) break;   
            
            // Close CDPs along the way that turn out to be under-collateralized
            if (getCurrentICR(currentCDPuser, price) < MCR) {
                liquidate(currentCDPuser);
            }
            else {
                applyPendingRewards(currentCDPuser); // *** 46000 gas (no rewards!)
              
                // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the current CDP 
                uint CLVLot = DeciMath.getMin(_CLVamount.sub(exchangedCLV), CDPs[currentCDPuser].debt); // 1200 gas
                uint ETHLot = uint(ABDKMath64x64.divu(CLVLot, uint(ABDKMath64x64.divu(price, 1e18))));
               
                // Decrease the debt and collateral of the current CDP according to the lot and corresponding ETH to send
                uint newDebt = (CDPs[currentCDPuser].debt).sub(CLVLot);
                CDPs[currentCDPuser].debt = newDebt; // 6200 gas
               
                uint newColl = (CDPs[currentCDPuser].coll).sub(ETHLot);
                CDPs[currentCDPuser].coll = newColl; // 6200 gas
                
                // Burn the calculated lot of CLV and send the corresponding ETH to _msgSender()
                poolManager.redeemCollateral(_msgSender(), CLVLot, ETHLot); // *** 57000 gas
               
                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.reInsert(currentCDPuser, getCurrentICR(currentCDPuser, price), price, _hint, _hint); // *** 62000 gas
                emit CDPUpdated(
                                currentCDPuser, 
                                newDebt, 
                                newColl,
                                CDPs[currentCDPuser].stake
                                ); // *** 5600 gas
                exchangedCLV = exchangedCLV.add(CLVLot);  // 102 gas    
                redeemedETH = redeemedETH.add(ETHLot); // 106 gas
            }
        }
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
        uint price = priceFeed.getPrice();
        address hintAddress = sortedCDPs.getLast();
        uint closestICR = getCurrentICR(hintAddress, price);
        uint diff = getAbsoluteDifference(CR, closestICR);
        uint i = 1;

        while (i < numTrials) {
            uint arrayIndex = getRandomArrayIndex(block.timestamp.add(i), CDPOwners.length);
            address currentAddress = CDPOwners[arrayIndex];
            uint currentICR = getCurrentICR(currentAddress, price);

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

    function getAbsoluteDifference(uint a, uint b) internal view returns(uint) {
        if (a >= b) {
            return a.sub(b);
        } else if (a < b) {
            return b.sub(a);
        }
    }

    // Convert input to pseudo-random uint in range [0, arrayLength - 1]
    function getRandomArrayIndex(uint input, uint _arrayLength) internal view returns(uint) {
        uint randomIndex = uint256(keccak256(abi.encodePacked(input))) % (_arrayLength);
        return randomIndex;
   }

    // Return the current collateral ratio (ICR) of a given CDP. Takes pending coll/debt rewards into account.
    function getCurrentICR(address _user, uint _price) public view returns(uint) {
        uint pendingETHReward = computePendingETHReward(_user); // 3700 gas (no rewards!)  ABDK: 3100
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);  // 3700 gas (no rewards!).  ABDK: 3100
        
        uint currentETH = CDPs[_user].coll.add(pendingETHReward); // 1000 gas
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);  // 988 gas
       
        uint ICR = computeICR(currentETH, currentCLVDebt, _price);  // 3500-5000 gas - low/high depends on zero/non-zero debt. ABDK: 100-500
        return ICR;
    }

    /* Compute the new collateral ratio, considering the collateral to be removed. Takes pending coll/debt 
    rewards into account. */
    function getNewICRfromCollDecrease(address _user, uint _collDecrease, uint _price) view internal returns(uint) {
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = CDPs[_user].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newColl = currentETH.sub(_collDecrease);
        
        return computeICR(newColl, currentCLVDebt, _price);
    }

    /* Compute the new collateral ratio, considering the debt to be added.Takes pending coll/debt rewards into account. */
    function getNewICRfromDebtIncrease(address _user, uint _debtIncrease, uint _price) view internal returns(uint) {
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        uint currentETH = CDPs[_user].coll.add(pendingETHReward);
        uint currentCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newCLVDebt = currentCLVDebt.add(_debtIncrease);

        return computeICR(currentETH, newCLVDebt, _price);
    } 

    function getNewICRFromPendingSPGain(address _user, uint price) internal returns (uint) {
        // Get rewards from direct distributions
        uint pendingETHReward = computePendingETHReward(_user);
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);

        // Get ETH Gain from StabilityPool deposit
        uint ETHGainFromSP = poolManager.getCurrentETHGain(_user);
        
        uint newColl = CDPs[_user].coll.add(pendingETHReward).add(ETHGainFromSP);
        uint newCLVDebt = CDPs[_user].debt.add(pendingCLVDebtReward);

        uint newICR = computeICR(newColl, newCLVDebt, price);
        return newICR;
    }

    function computeICR(uint _coll, uint _debt, uint _price) view internal returns(uint) {
        // Check if the total debt is higher than 0, to avoid division by 0
        if (_debt > 0) {
            uint newCollRatio = ABDKMath64x64.mulu(ABDKMath64x64.divu(_coll, _debt), _price);
            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else {
            return 2**256 - 1; 
        }
    }

    // Add the user's coll and debt rewards earned from liquidations, to their CDP
    function applyPendingRewards(address _user) internal returns(bool) {
        if (rewardSnapshots[_user].ETH == L_ETH) { return false; }
        require(CDPs[_user].status == Status.active, "CDPManager: user must have an active CDP");  // 2866 gas (no rewards)

        // Compute pending rewards
        uint pendingETHReward = computePendingETHReward(_user); // 5530 gas  (no rewards)
        uint pendingCLVDebtReward = computePendingCLVDebtReward(_user);  // 5540 gas  (no rewards)

        // Apply pending rewards
        CDPs[_user].coll = CDPs[_user].coll.add(pendingETHReward);  // 3800 gas (no rewards)
        CDPs[_user].debt = CDPs[_user].debt.add(pendingCLVDebtReward); // 3800 gas (no rewards)

        // Tell PM to transfer from DefaultPool to ActivePool when user claims rewards.
        poolManager.applyPendingRewards(pendingCLVDebtReward, pendingETHReward);  // 33000 gas (no rewards)

        updateRewardSnapshots(_user); // 5259 (no rewards)
        return true;
    }

    // Update user's snapshots of L_ETH and L_CLVDebt to reflect the current values
    function updateRewardSnapshots(address _user) internal returns(bool) {
        rewardSnapshots[_user].ETH = L_ETH; // 1700 gas (no rewards)
        rewardSnapshots[_user].CLVDebt = L_CLVDebt; // 1700 gas (no rewards)
        return true;
    }

    // Get the user's pending accumulated ETH reward, earned by its stake
    function computePendingETHReward(address _user) internal view returns(uint) {
        uint snapshotETH = rewardSnapshots[_user].ETH; // 913 gas (no reward)
        uint rewardPerUnitStaked = L_ETH.sub(snapshotETH); 
        
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        uint stake = CDPs[_user].stake;  // 950 gas (no reward)
        
        uint pendingETHReward = ABDKMath64x64.mulu(ABDKMath64x64.divu(rewardPerUnitStaked, 1e18), stake);
        return pendingETHReward;
    }

     // Get the user's pending accumulated CLV reward, earned by its stake
    function computePendingCLVDebtReward(address _user) internal view returns(uint) {
        uint snapshotCLVDebt = rewardSnapshots[_user].CLVDebt;  // 900 gas
        uint rewardPerUnitStaked = L_CLVDebt.sub(snapshotCLVDebt); 
       
        if ( rewardPerUnitStaked == 0 ) { return 0; }
       
        // console.log("00. gas left: %s", gasleft());
        uint stake =  CDPs[_user].stake;  // 900 gas
      
        uint pendingCLVDebtReward = ABDKMath64x64.mulu(ABDKMath64x64.divu(rewardPerUnitStaked, 1e18), stake);
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
        uint newStake = computeNewStake(CDPs[_user].coll); 
        uint oldStake = CDPs[_user].stake;
        CDPs[_user].stake = newStake;
        totalStakes = totalStakes.sub(oldStake).add(newStake);

        return true;
    }

    function computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            stake = ABDKMath64x64.mulu(ABDKMath64x64.divu(totalStakesSnapshot, totalCollateralSnapshot), _coll);
        }
     return stake;
    }

    function redistributeCollAndDebt(uint _coll, uint _debt) internal returns (bool) {
        if (_debt > 0) {
            if (totalStakes > 0) {
                /*If debt could not be offset entirely, add the coll and debt rewards-per-unit-staked 
                to the running totals. */
              
                uint ETHRewardPerUnitStaked = ABDKMath64x64.mulu(ABDKMath64x64.divu(_coll, totalStakes), 1e18);
                uint CLVDebtRewardPerUnitStaked = ABDKMath64x64.mulu(ABDKMath64x64.divu(_debt, totalStakes), 1e18);
                
                L_ETH = L_ETH.add(ETHRewardPerUnitStaked);
                L_CLVDebt = L_CLVDebt.add(CLVDebtRewardPerUnitStaked);
            }
            // Transfer coll and debt from ActivePool to DefaultPool
            poolManager.liquidate(_debt, _coll);
        } 
    }

    function closeCDP(address _user) internal returns (bool) {
        CDPs[_user].status = Status.closed;
        CDPs[_user].coll = 0;
        CDPs[_user].debt = 0;
        
        sortedCDPs.remove(_user);
        removeCDPOwner(_user);
       
        return true;
    }

    // Update the snapshots of system stakes & system collateral
    function updateSystemSnapshots() internal returns (bool) {
        totalStakesSnapshot = totalStakes;

        /* The total collateral snapshot is the sum of all active collateral and all pending rewards
       (ActivePool ETH + DefaultPool ETH), immediately after the liquidation occurs. */
        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.add(liquidatedColl);

        return true;
    }

    // Updates snapshots of system stakes and system collateral, excluding a given collateral remainder from the calculation
     function updateSystemSnapshots_excludeCollRemainder(uint _collRemainder) internal returns (bool) {
        totalStakesSnapshot = totalStakes;

        uint activeColl = activePool.getETH();
        uint liquidatedColl = defaultPool.getETH();
        totalCollateralSnapshot = activeColl.sub(_collRemainder).add(liquidatedColl);

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

    // Get the dollar value of collateral, as a duint
    function getUSDValue(uint _coll, uint _price) internal view returns (uint) {
        uint usdValue = ABDKMath64x64.mulu(ABDKMath64x64.divu(_price, 1000000000000000000), _coll);  // 500 gas
        return usdValue;
    }

    function getNewTCR(uint _collIncrease, uint _debtIncrease, uint _price) internal view returns (uint) {
        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl).add(_collIncrease);
        uint newTotalDebt = activeDebt.add(closedDebt).add(_debtIncrease);

        uint newTCR = computeICR(totalCollateral, newTotalDebt, _price);
        return newTCR;
    }

    function getNewTCRFromDecrease(uint _collDecrease, uint _debtDecrease, uint _price) internal view returns (uint) {
        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral = activeColl.add(liquidatedColl).sub(_collDecrease);
        uint newTotalDebt = activeDebt.add(closedDebt).sub(_debtDecrease);

        uint newTCR = computeICR(totalCollateral, newTotalDebt, _price);
        return newTCR;
    }

    function checkTCRAndSetRecoveryMode(uint _price) public returns (bool){
        uint activeColl = activePool.getETH();
        uint activeDebt = activePool.getCLV();
        uint liquidatedColl = defaultPool.getETH();
        uint closedDebt = defaultPool.getCLV();

        uint totalCollateral  = activeColl.add(liquidatedColl); // 86 gas
       
        uint totalDebt = activeDebt.add(closedDebt); // 90 gas

        uint TCR = computeICR(totalCollateral, totalDebt, _price); // 575 gas
        
        /* if TCR falls below 150%, trigger recovery mode. If TCR rises above 150%, 
        disable recovery mode */
        bool recoveryModeInMem;

        if ((TCR < 1500000000000000000) && (recoveryMode == false)) {
            recoveryMode = true;
            recoveryModeInMem = true;
        } else if ((TCR >= 1500000000000000000) && (recoveryMode == true)) {
            recoveryMode = false;
            recoveryModeInMem = false;
        }
        return recoveryModeInMem;
    }
}