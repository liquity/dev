pragma solidity ^0.5.11;

// TODO: Use SafeMath
import "./CLVToken.sol";
import "./PriceFeed.sol";
import "./SortedDoublyLL.sol";
import "./PoolManager.sol";
import "./DeciMathBasic.sol";
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";

contract CDPManager is Ownable {
    using SafeMath for uint;
    using SortedDoublyLL for SortedDoublyLL.Data;

    string public name;
    uint constant DIGITS = 1e18; // Number of digits used for precision, e.g. when calculating redistribution shares. Equals "ether" unit.
    uint constant MCR = (11 * DIGITS) / 10; // Minimal collateral ratio (e.g. 110%). TODO: Allow variable MCR
    uint constant MAX_DRAWDOWN = 20; // Loans cannot be drawn down more than 5% (= 1/20) below the TCR when receiving redistribution shares
    enum Status { inexistent, newBorn, active, closed }
    
    // --- Events --- 
    event PoolManagerAddressChanged(address _newPoolManagerAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event CLVTokenAddressChanged(address _newCLVTokenAddress);

    event CDPCreated(address _user);
    event CDPUpdated(address _user, uint _debt, uint _coll, uint ICR);
    event CDPClosed(address _user);

    event CollateralAdded(address _user, uint _amountAdded);
    event CollateralWithdrawn(address _user, uint _amountWithdrawn);
    event CLVWithdrawn(address _user, uint _amountWithdrawn);
    event CLVRepayed(address _user, uint _amountRepayed);
    event CollateralRedeemed(address _user, uint redeemedAmount);

    // --- Connected contract declarations ---
    PoolManager poolManager;
    address public poolManagerAddress;

    CLVToken CLV; 
    address public clvTokenAddress;

    PriceFeed priceFeed;
    address public priceFeedAddress;

    // --- Data structures ---

    // Stores the necessary data for a Collateralized Debt Position (CDP)
    struct CDP {
        uint debt;
        uint coll;
        uint ICR; // Individual Collateral Ratio
        Status status;
    }
    
    mapping (address => CDP) public CDPs; // A map of all new CDPs: created but no initial collateral
    // mapping (address => CDP) public activeCDPs; // A map of all existing (active and closed) CDPs
    // mapping (address => CDP) public closedCDPs;
    SortedDoublyLL.Data public sortedCDPs; // A doubly linked CDP list sorted by the collateral ratio of the CDPs

    // Register the owner and the name of the CDP contract and install other contracts

    constructor() public payable {
        sortedCDPs.setMaxSize(1000000);
    }   

    // --- Contract setters --- 
    function setPoolManager(address _poolManagerAddress) public onlyOwner {
        poolManagerAddress = _poolManagerAddress;
        poolManager = PoolManager(_poolManagerAddress);
        emit PoolManagerAddressChanged(_poolManagerAddress);
    }

    function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = PriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

     function setCLVToken(address _clvTokenAddress) public onlyOwner {
        clvTokenAddress = _clvTokenAddress;
        CLV = CLVToken(_clvTokenAddress);
        emit CLVTokenAddressChanged(_clvTokenAddress);
    }

    // --- Getters ---
    function getMCR() public pure returns(uint) {
        return MCR;
    }

    function getAccurateMulDiv(uint x, uint y, uint z) public pure returns(uint) {
        return DeciMathBasic.accurateMulDiv(x, y, z);
    }
    /* --- SortedDoublyLinkedList (SDLL) getters and checkers. These enable public usage
    of the corresponding SDLL functions, operating on the sortedCDPs struct --- */

    function sortedCDPsContains(address id) public view returns (bool) {
        return sortedCDPs.contains(id);
    }

    function sortedCDPsIsEmpty() public view returns (bool) {
        return sortedCDPs.isEmpty();
    }

    function sortedCDPsIsFull() public view returns (bool) {
        return sortedCDPs.isFull();
    }

    function sortedCDPsgetSize() public view returns(uint) {
        return sortedCDPs.getSize();
    }

    function sortedCDPsGetMaxSize() public view returns(uint) {
        return sortedCDPs.getMaxSize();
    }

    function sortedCDPsGetKey(address user) public view returns(uint) {
        return sortedCDPs.getKey(user);
    }

    function sortedCDPsGetFirst() public view returns (address) {
        return sortedCDPs.getFirst();
    }

    function sortedCDPsGetLast() public view returns (address) {
        return sortedCDPs.getLast();
    }

    function sortedCDPsGetNext(address user) public view returns (address) {
        return sortedCDPs.getNext(user);
    }

    function sortedCDPsGetPrev(address user) public view returns (address) {
        return sortedCDPs.getPrev(user);
    }

    // ---

    // Returns the new collateral ratio considering the debt and/or collateral that should be added or removed 
    function getNewCollRatio(address _debtor, uint _debt_change, uint _coll_change) 
        view 
        internal 
        returns (uint) 
    {
        uint newColl = (CDPs[_debtor].coll).add(_coll_change);
        uint newDebt = (CDPs[_debtor].debt).add(_debt_change);
        uint price = priceFeed.getPrice();
        // Check if the total debt is higher than 0 to avoid division by 0
        if (newDebt > 0) {
            uint newCollRatio = DeciMathBasic.accurateMulDiv(newColl, price, newDebt);
            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else {
            return 2**256 - 1; 
        }
    }
    
    // Returns the current collateral ratio of a specified CDP
    function getCollRatio(address _debtor) 
        public
        view 
        returns (uint) 
    {
        return getNewCollRatio(_debtor, 0, 0);
    }
    
    // Create a new CDP
    function userCreateCDP() 
        public
        returns (bool) 
    {
        address user = _msgSender();
        createCDP(user);

        return true;
    }

    function createCDP(address _account) 
        internal 
        returns (bool) 
    {
        require(CDPs[_account].status == Status.inexistent, "CDPManager: CDP already exists");
        CDPs[_account].status = Status.newBorn; 
        CDPs[_account].ICR = getCollRatio(_account);

        emit CDPCreated(_account);

        return true;
    }
    
    // Pay a given number of ETH (msg.value) as collateral to a CDP 
    function addColl() 
        public 
        payable 
        returns (bool) 
    {
        address user = _msgSender();
        bool isFirstCollDeposit = false;
        // Potential issue with using _msgSender() as the key in the CDPs map: Users may not be able interact via other contracts since the 
        // _msgSender() would then be the contract rather than the transacting user. Beware of tx.origin.
        require(CDPs[user].status != Status.closed, "CDPManager: CDP is closed");
        
        if (CDPs[user].status == Status.inexistent) {
            createCDP(user);
            isFirstCollDeposit = true; 
        } else if (CDPs[user].status == Status.newBorn) {
            isFirstCollDeposit = true;
        }
            
        CDPs[user].status = Status.active;
       
        // Add the received collateral to the CDP 
        CDPs[user].coll = (CDPs[user].coll).add(msg.value);

        // Send the received collateral to PoolManager, to forward to ActivePool
        poolManager.addColl.value(msg.value)();

        // get user's new ICR
        uint newICR = getCollRatio(user);

        // Get CDP debt
        uint debt = CDPs[user].debt;

        // update the ICR in the CDP mapping
        CDPs[user].ICR = newICR;
        
        // Insert or update the ICR  in sortedCDPs
        if (isFirstCollDeposit) {
            sortedCDPs.insert(user, newICR, user, user);
        } else {
            sortedCDPs.updateKey(user, newICR, user, user);
        }

        emit CollateralAdded(user, msg.value);
        emit CDPUpdated(user, CDPs[user].debt, CDPs[user].coll, CDPs[user].ICR);
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
    
    // Withdraw ETH collateral from a CDP
    // TODO: Check re-entrancy protection
    function withdrawColl(uint _amount) 
        public 
        returns (bool) 
    {
        address payable user = _msgSender();
        uint newICR = getNewCollRatio(user, 0, -_amount);

        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(CDPs[user].coll >= _amount, "CDPManager: Insufficient balance for ETH withdrawal");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for ETH withdrawal");
        
        // Reduce the ETH collateral by _amount
        CDPs[user].coll = (CDPs[user].coll).sub(_amount);

        // update the ICR in the CDP mapping
        CDPs[user].ICR = newICR;

        // Update ICR in sortedCDPs
        sortedCDPs.updateKey(user, newICR, user, user);
        
        // Remove _amount ETH from ActivePool and send it to the user
        poolManager.withdrawColl(user, _amount);
        
        emit CollateralWithdrawn(user, _amount);
        emit CDPUpdated(user, CDPs[user].debt, CDPs[user].coll, CDPs[user].ICR);
        return true;
    }
    
    // Withdraw CLV tokens from a CDP: Mint new CLV and increase the debt accordingly
    function withdrawCLV(uint _amount) 
        public 
        returns (bool) 
    {
        address user = _msgSender();
        uint newICR = getNewCollRatio(user, _amount, 0);

        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Amount to withdraw must be larger than 0");
        require(newICR >= MCR, "CDPManager: Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the debt by the withdrawn amount of CLV
        CDPs[user].debt = (CDPs[user].debt).add(_amount);

        // update the ICR in the CDP mapping
        CDPs[user].ICR = newICR;

        // Mint the given amount of CLV, add them to the ActivePool and send them to CDP owner's address 
        poolManager.withdrawCLV(user, _amount);
        
        // Update entry in sortedCDPs
        sortedCDPs.updateKey(user, newICR, user, user);

        emit CLVWithdrawn(user, _amount);
        emit CDPUpdated(user, CDPs[user].debt, CDPs[user].coll, CDPs[user].ICR);
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens and reduce the debt accordingly
    function repayCLV(uint _amount) 
        public 
        returns (bool) 
    {
        address user = _msgSender();

        require(CDPs[user].status == Status.active, "CDPManager: CDP does not exist or is closed");
        require(_amount > 0, "CDPManager: Repaid amount must be larger than 0");
        require(_amount <= CDPs[user].debt, "CDPManager: Repaid amount is larger than current debt");
        require(CLV.balanceOf(user) >= _amount, "CDPManager: Sender has insufficient CLV balance");
        // TODO: Maybe allow foreign accounts to repay loans
        
        // Reduce the debt
        CDPs[user].debt  = (CDPs[user].debt).sub(_amount);

        // Calculate new Coll ratio
        uint newICR = getCollRatio(user);
        
        // Update entry in sortedCDPs
        sortedCDPs.updateKey(user, newICR, user, user);

        // Burn the received amount of CLV and remove them from the ActivePool
        poolManager.repayCLV(user, _amount);

        emit CLVRepayed(user, _amount);
        emit CDPUpdated(user, CDPs[user].debt, CDPs[user].coll, CDPs[user].ICR);
        return true;
    }

    // Closes the CDP of the speficied _debtor if its individual collateral ratio is lower than the minimum collateral ratio.
    // TODO: This function should eventually be internal and only be called by closeCDPs(...). 
    function close(address _debtor) 
        public 
        returns (bool) 
    {
        require(CDPs[_debtor].status == Status.active, "CDPManager: CDP does not exist or is already closed");
        require(getCollRatio(_debtor) < MCR, "CDPManager: CDP not undercollateralized");
        
        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = poolManager.offset(CDPs[_debtor].debt, CDPs[_debtor].coll);
        if (remainder[0] > 0) {
            // If the debt could not be offset entirely, transfer the remaining debt & collateral from Active Pool to Default Pool 
            // Note: remainder[0] = remaining debt; remainder[1] = remaining collateral;
            poolManager.close(remainder[0], remainder[1]);
        }
        
        // Close the CDP
        CDPs[_debtor].status = Status.closed;
        
        // Remove CDP from sortedCDPs
        sortedCDPs.remove(_debtor);
        emit CDPClosed(_debtor);
        return true;
    }
     
    
    // Closes a maximum number of n multiple undercollateralized CPDs, starting from the one with the lowest collateral ratio
    // Caller: anybody 
    // TODO: Should probably be synchronized with PriceFeed and called every time the price is updated
    function closeCDPs(uint n)
        public
        returns (bool)
    {    
        uint i;
        while (i < n) {
            address currentCDP = sortedCDPs.getLast();
            uint collRatio = getCollRatio(currentCDP);
            
            // Close CDPs if it is undercollateralized
            if (collRatio < MCR) {
                close(currentCDP);
            } else break;
            
            // Break loop if you reach the first CDP in the sorted list 
            // Check if issue with changing list position
            if (currentCDP == sortedCDPs.getFirst()) 
                break;
            
            i++;
        }       
        return true;
     }
            
            
    // The specified _debtor obtains the given debt share and the corresponding collateral share from the default pool   
    // Caller: anybody
    
    // TODO: Implement some more sophisticated logic that for example only allows the public to assign a debt & coll share
    // to any CDP if the Default Pool is indebted (i.e. its collateral ratio is < 100%). Otherwise, only the owner of a CDP
    // should be able to obtain a default share for himself. In this case, maybe impose more limits as described in the
    // slide deck. Optimally, we could get rid of this mechanism alltogether and distribute undercollateralized loans that
    // could not be offset against the Stability Pool in proportion to some excess collateral above a given threshold.
    function obtainDefaultShare(address _user, uint _debtShare) 
        public 
        returns (bool) 
    {
        uint closedDebt = poolManager.getClosedDebt();
        uint closedColl = poolManager.getClosedColl();
        uint TCR = poolManager.getTCR();
        uint collShare = DeciMathBasic.accurateMulDiv(_debtShare, closedColl, closedDebt); // Calculate collateral share coll from _debt
        uint newICR = getNewCollRatio(_user, _debtShare, collShare);
        
        require(CDPs[_user].status == Status.active, "CDPManager: Recipient must own an active CDP");
        require(_debtShare <= closedDebt, "CDPManager: Debt in the default pool smaller than the specified debt share");
        require(newICR > TCR.sub(TCR / MAX_DRAWDOWN), "CDPManager: Collateral ratio would be drawn below maximum drawdown");
        // Add debt & coll share to the CDP and to the total and remove them from the default pool
        CDPs[_user].debt  = (CDPs[_user].debt).add(_debtShare);
        CDPs[_user].coll = (CDPs[_user].debt).add(collShare);
        
        poolManager.obtainDefaultShare(_debtShare, collShare);
        emit CDPUpdated(_user, CDPs[_user].debt, CDPs[_user].coll, CDPs[_user].ICR);

        return true;
    }
    
    // Returns the lower value from two given integers
    function getMin(uint a, uint b) 
        internal
        pure
        returns (uint)
    {
        if (a <= b) return a;
        else return b;
    }    
    
    // Sends _amount CLV to the system and redeems the corresponding amount of collateral from as many CDPs as are needed to fill the redemption
    // request. Note that if _amount is very large, this function can run out of gas. This can be easily avoided by splitting the total _amount
    // in appropriate chunks and calling the function multiple times.
    
    // TODO: Maybe also use the default pool for redemptions
    // TODO: Levy a redemption fee (and maybe also impose a rate limit on redemptions)
    function redeemCollateral(uint _amount) 
        public
        returns (bool)
    {
        address payable user = _msgSender();
        require(CLV.balanceOf(user) >= _amount, "CDPManager: Sender has insufficient balance");
        uint redeemed;

        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (redeemed < _amount) {

            address currentCDPuser = sortedCDPs.getLast();
            uint collRatio = getCollRatio(currentCDPuser);
            uint price = priceFeed.getPrice();
            uint activeDebt = poolManager.getActiveDebt();
            
            // Close CDPs along the way that turn out to be undercollateralized
            if (collRatio < MCR) {
                close(currentCDPuser);
            }
            else {
                // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the current CDP 
                uint lot = getMin(_amount.sub(redeemed), CDPs[currentCDPuser].debt);
                    
                // Decrease the debt and collateral of the current CDP according to the lot
                // TODO: Readability - too dense. Extract temp vars
                CDPs[currentCDPuser].debt = (CDPs[currentCDPuser].debt).sub(lot);
                CDPs[currentCDPuser].coll = (CDPs[currentCDPuser].coll).sub(DeciMathBasic.accurateMulDiv(lot, DIGITS, price));
                uint newCollRatio = getCollRatio(currentCDPuser);

                // Burn the calculated lot of CLV and send the corresponding ETH to _msgSender()
                poolManager.redeemCollateral(user, lot, (lot.mul(DIGITS)) / price);

                // TODO - Rick: What is this check for activeDebt == 0 really doing here? And should it come before
                // updating the currentCDP's position in sortedCDPs?

                // Break the loop if there is no more active debt to redeem 
                if (activeDebt == 0) break;    
                
                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.updateKey(currentCDPuser, newCollRatio, user, user); 
                emit CDPUpdated(currentCDPuser, CDPs[currentCDPuser].debt, CDPs[currentCDPuser].coll, CDPs[currentCDPuser].ICR);

                redeemed = redeemed.add(lot);   
            }
        }
        emit CollateralRedeemed(user, redeemed);
    }    
}