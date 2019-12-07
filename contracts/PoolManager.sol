pragma solidity ^0.5.11;

// import "./StabilityPool.sol";
// import "./ActivePool.sol";
// import "./DefaultPool.sol";
import './IPool.sol';

import "./PriceFeed.sol";
import "./CLVToken.sol";
import '../node_modules/@openzeppelin/contracts/ownership/Ownable.sol';

// Maintains all pools and holds the ETH and CLV balances
contract PoolManager is Ownable {

    struct Snapshot {
        uint ETH;
        uint CLV;
    }
    uint constant DIGITS = 1e18;

    address public cdpManagerAddress;

    PriceFeed priceFeed;
    address public priceFeedAddress;

    CLVToken CLV; 
    address public clvAddress;

    IPool public stabilityPool;
    address payable public stabilityPoolAddress;

    IPool public activePool;
    address payable public activePoolAddress;

    IPool public defaultPool;
    address payable public defaultPoolAddress;
   
    mapping (address => uint) public deposit; // A map of all deposits
    
    uint public S_CLV; // A running total of the CLV fractions for gas-efficient share calculation
    uint public S_ETH; // A running total of the ETH fractions for gas-efficient share calculation
    mapping (address => Snapshot) public snapshot; // A map of individual snapshots of the S_CLV and the current Stability.ETH values
    
    modifier onlyCDPManager() {
        require(_msgSender() == cdpManagerAddress, "PoolManager: Caller is not the CDPManager");
        _;
    }

    constructor() public {
    }

    // --- Dependency setters ---
    function setCLVToken(address _CLVAddress) public onlyOwner {
        clvAddress = _CLVAddress;
        CLV = CLVToken(_CLVAddress); 
    }
     function setPriceFeed(address _priceFeedAddress) public onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        priceFeed = PriceFeed(_priceFeedAddress);
    }

    function setCDPManagerAddress(address _cdpManagerAddress) public onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
    }

    function setStabilityPool(address payable _stabilityPoolAddress) public onlyOwner {
        stabilityPoolAddress = _stabilityPoolAddress;
        stabilityPool = IPool(stabilityPoolAddress);
    }

    function setActivePool(address payable _activePoolAddress) public onlyOwner {
        activePoolAddress = _activePoolAddress;
        activePool = IPool(activePoolAddress);
    }

    function setDefaultPool(address payable _defaultPoolAddress) public onlyOwner {
        defaultPoolAddress = _defaultPoolAddress;
        defaultPool = IPool(defaultPoolAddress);
    }

    // --- Getters ---

    // Returns the total collateral ratio of the system
    function getTCR() 
        view 
        public 
        returns (uint) 
    {
        uint activePoolETH = activePool.getETH();
        uint activePoolCLV = activePool.getCLV();

        // Handle edge cases of div by 0
        if(activePoolETH == 0 && activePoolCLV == 0 ) { 
            return 1;
        }  else if (activePoolETH != 0 && activePoolCLV == 0 ) {
            return 2**256 - 1; // TCR is technically infinite
        } 

        // calculate TCR
        return activePool.getETH() * priceFeed.getPrice() / activePool.getCLV();
    }
    
    // Returns the current ETH balance of the TokenPools contract
    function getBalance() 
        public
        view
        returns (uint)
    {
        return address(this).balance;
    } 
    
    // Returns the total active debt (in CLV) in the system
    function getActiveDebt() 
        public
        view
        returns (uint)
    {
        return activePool.getCLV();
    }    
    
    // Returns the total active collateral (in ETH) in the system
    function getActiveColl() 
        public
        view
        returns (uint)
    {
        return activePool.getETH();
    } 
    
    // Returns the amount of closed debt (in CLV)
    function getClosedDebt() 
        public
        view
        returns (uint)
    {
        return defaultPool.getCLV();
    }    
    
    // Returns the amount of closed collateral (in ETH)
    function getClosedColl() 
        public
        view
        returns (uint)
    {
        return defaultPool.getETH();
    }  
    
    // Returns the lower value from two given integers
    function getMin(uint a, uint b) 
        public
        pure
        returns (uint)
    {
        if (a <= b) return a;
        else return b;
    }    
    
    // ***For testing purposes only***: Initializes a CDP with the received ETH and the specified amount of CLV
    // function initializeCDP(address _account, uint _CLV)
    //     public
    //     payable
    //     onlyCDPManager
    //     returns (bool)
    // {
    //     Active.CLV += _CLV;
    //     Active.ETH += msg.value;
    //     CLV.mint(_account, _CLV);
        
    //     return true;
    // }
    
    // ***For testing purposes only***: Transfers the speficied amount of CLV from one account to another
    // function transferCLV(address _from, address _to, uint _amount)
    //     public
    //     onlyCDPManager
    //     returns (bool)
    // {
    //     CLV.burn(_from, _amount);
    //     CLV.mint(_to, _amount);
    // }    
    
    // Adds the received ETH to the total active collateral
    function addColl()
        public
        payable
        onlyCDPManager
        returns (bool)
    {
        // send ETH to Active Pool and increase its recorded ETH balance 
        activePool.increaseETH(msg.value);

       (bool success, ) = activePoolAddress.call.value(msg.value)("");
       require (success == true, 'PoolManager: transaction to activePool reverted');
       return success;
    }
    
    // Transfers the specified amount of ETH to _account and updates the total active collateral 
    function withdrawColl(address payable _account, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.sendETH(_account, _ETH);
        return true;
    }
    
    // Issues the specified amount of CLV to _account and increases the total active debt
    function withdrawCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.increaseCLV(_CLV);
        CLV.mint(_account, _CLV);
                
        return true;
    }
    
    // Burns the specified amount of CLV from _account and decreases the total active debt
    function repayCLV(address _account, uint _CLV)
        public
        onlyCDPManager
        returns (bool)
    {
        activePool.decreaseCLV(_CLV);
        CLV.burn(_account, _CLV);
        
        return true;
    }           
    
    // Updates the Active Pool and the Default Pool when a CDP gets closed
    function close(uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {
        // Transfer the debt & coll from the Active Pool to the Default Pool
        defaultPool.increaseCLV(_CLV);
        defaultPool.increaseETH(_ETH);
        activePool.decreaseCLV(_CLV);
        activePool.sendETH(defaultPoolAddress, _ETH);
        
        return true;
    }    
    
    // Updates the Active Pool and the Default Pool when a CDP obtains a default share
    function obtainDefaultShare(uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {    
        // Transfer the debt & coll from the Default Pool to the Active Pool
        defaultPool.decreaseCLV(_CLV);
        activePool.increaseCLV(_CLV);
        activePool.increaseETH(_ETH);
        defaultPool.sendETH(activePoolAddress, _ETH);
 
        return true;
    }
    
    // Burns the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(address payable _account, uint _CLV, uint _ETH)
        public
        onlyCDPManager
        returns (bool)
    {    
        // Update Active Pool CLV, and send ETH to account
        activePool.decreaseCLV(_CLV);
        activePool.sendETH(_account, _ETH);
        
        CLV.burn(_account, _CLV);

        return true;
    }    

    // Deposits the specified amount to the Stability Pool using the algorithm from http://batog.info/papers/scalable-reward-distribution.pdf
    // Can be called directly by anybody, not just by the owner (CDP contract) 
    // TODO: Support multiple deposits by the same address
    // TODO: CDP holders which make a deposit should be able to redirect the received ETH to their CDPs
    function depositCLV( uint _amount) 
        public
        returns (bool)
    {
        address user = _msgSender();
        require(_amount > 0, "PoolManager: deposited amount must be larger than 0");
        require(CLV.balanceOf(user) >= _amount, "PoolManager: user has insufficient balance");
        
        // Transfer the CLV tokens from the user to the Stability Pool's address, and update its recorded CLV
        CLV.sendToPool(user, stabilityPoolAddress, _amount);
        // Stability.CLV += _amount;
        stabilityPool.increaseCLV(_amount);
        
        // Record the deposit made by user
        deposit[user] += _amount;
        
        // Record an individual snapshot of the running totals S_CLV and S_ETH for the user
        snapshot[user].CLV = S_CLV;
        snapshot[user].ETH = stabilityPool.getETH();
        
        return true;
    }   
    
    // TODO - rename.  "offsetAndLiquidate()" ?
    // Cancels out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    // and transfers the CDP's ETH collateral from Active Pool to Stability Pool. 
    // Returns the amount of debt & coll that could not be cancelled out.
    // Can only be called via the close(...) and closeCDPs(... ) functions in CDPManager
    function offset(uint _debt, uint _coll)
        public
        payable
        onlyCDPManager
        returns (uint[2] memory) // Note: it would be nicer to return this as a struct, but struct returns are still experimental
    {    
        require(stabilityPool.getCLV() > 0, "PoolManager: stability pool is empty");
        
        // If the debt is larger than the deposited CLV, only offset an amount of debt corresponding to the latter
        uint debtToDistribute = getMin(_debt, stabilityPool.getCLV());
        // Determine the amount of collateral to be distributed in proportion to the debt that is distributed
        uint collToDistribute = (((debtToDistribute * DIGITS) / _debt) * _coll) / DIGITS;
        
        // Update the running total S_CLV by adding the ratio between the distributed debt and the CLV in the pool
        S_CLV += (debtToDistribute * DIGITS) / stabilityPool.getCLV();
        // Update the running total S_ETH by adding the ratio between the distributed collateral and the ETH in the pool
        S_ETH += (collToDistribute * DIGITS) / stabilityPool.getETH();
        
        // Cancel the liquidated CLV debt with the CLV in the stability pool
        activePool.decreaseCLV(debtToDistribute);  
        stabilityPool.decreaseCLV(debtToDistribute); 
        // Send ETH from Active Pool to Stability Pool
        stabilityPool.increaseETH(collToDistribute); // update recorded ETH balance in Stability Pool
        activePool.sendETH(stabilityPoolAddress, collToDistribute);   // send ether from Active to Stability Pool
        
        // Burn the debt that was successfully offset
        CLV.burn(stabilityPoolAddress, debtToDistribute);
        
        // Return the amount of debt & coll that could not be offset against the Stability Pool due to insufficiency
        uint[2] memory remainder;
        remainder[0] = _debt - debtToDistribute;
        remainder[1] = _coll - collToDistribute;
        return remainder;
    }
    
    // Retrieves the caller's funds from the Stability Pool
    // TODO: Support partial withdrawals
    function retrieve() 
        public
        returns (bool)
    {   
        address payable user = _msgSender();
        require(deposit[user] > 0, "PoolManager: caller has no deposit");
        
        // Calculate the CLV and ETH shares to be retrieved according http://batog.info/papers/scalable-reward-distribution.pdf
        // TODO: Check for div/0
        // Problem: Rounding errors lead to results like 666666666666666600 instead of 666666666666666666 
        // TODO: check calculations
        uint CLVShare = deposit[user] - (deposit[user] * (S_CLV - snapshot[user].CLV)) / DIGITS;
        uint ETHShare = (deposit[user] * (S_ETH - snapshot[user].ETH)) / DIGITS;
        
        //update user's deposit record
        deposit[user] = 0;
        // TODO: Beware of rounding errors that may lead to underflows

        /* TODO: Calcs? Shouldn't max withdrawal calculation come earlier, and impact withdrawable CLV and ETH.
        If not enough CLV in pool, withdraw a mixture of CLV and ETH, of equal value to the user's entitlement.
        */
        CLV.returnFromPool(stabilityPoolAddress, user, getMin(CLVShare, stabilityPool.getCLV()));
        stabilityPool.decreaseCLV(CLVShare);
        
        // Return the ether to the caller
         stabilityPool.sendETH(user, ETHShare);
        
        return true;
    }
}    