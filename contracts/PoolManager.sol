pragma solidity >0.5.0;

import "./PriceFeed.sol";
import "./Token.sol";

// Maintains all pools and holds the ETH and CLV balances
contract PoolManager {
    struct Pool {
        uint CLV;
        uint ETH;   
    }
    
    uint digits;
    address owner;
    ETHPriceFeed PriceFeed;
    CLVToken CLV; 
    
    Pool public Stability; // Stability Pool: Contains the deposited CLV and the collateral of closed CDPs
    Pool public Active; // Active Pool: Contains the total amount of active collateral and debt in the system
    Pool public Default; // Default Pool: Contains the the debt and collateral of closed CPDs that could not be absorbed by the Stability Pool
    
    mapping (address => Pool) public deposit; // A map of all deposits
    uint public S_CLV; // A running total of the CLV fractions for gas-efficient share calculation
    uint public S_ETH; // A running total of the ETH fractions for gas-efficient share calculation
    mapping (address => Pool) public snapshot; // A map of individual snapshots of the S_CLV and the current Stability.ETH values
    
    // Declare these public variables for debugging in Remix
    //uint256 public ETHShare;
    //uint256 public CLVShare; 
    
    // Makes sure the caller is the owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }
    
    constructor(uint _digits, address _PriceFeed, address _token) 
        public
    {
        owner = msg.sender;
        digits = _digits;
        
        CLV = CLVToken(_token);
        PriceFeed = ETHPriceFeed(_PriceFeed);
    }
    
    // Returns the total collateral ratio of the system
    function getTCR() 
        view 
        public 
        returns (uint) 
    {
        return Active.ETH * PriceFeed.getPrice() / Active.CLV;
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
    function activeDebt() 
        public
        view
        returns (uint)
    {
        return Active.CLV;
    }    
    
    // Returns the total active collateral (in ETH) in the system
    function activeColl() 
        public
        view
        returns (uint)
    {
        return Active.ETH;
    } 
    
    // Returns the amount of closed debt (in CLV)
    function closedDebt() 
        public
        view
        returns (uint)
    {
        return Default.CLV;
    }    
    
    // Returns the amount of closed collateral (in ETH)
    function closedColl() 
        public
        view
        returns (uint)
    {
        return Default.ETH;
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
    
    // ***For testing purposes only***: Initializes a CDP with the received ETH and the specified amount of CLV
    function initializeCDP(address _account, uint _CLV)
        public
        payable
        onlyOwner
        returns (bool)
    {
        Active.CLV += _CLV;
        Active.ETH += msg.value;
        CLV.mint(_account, _CLV);
        
        return true;
    }
    
    // ***For testing purposes only***: Transfers the speficied amount of CLV from one account to another
    function transferCLV(address _from, address _to, uint _amount)
        public
        onlyOwner
        returns (bool)
    {
        CLV.burn(_from, _amount);
        CLV.mint(_to, _amount);
    }    
    
    // Adds the received ETH to the total active collateral
    function addColl()
        public
        payable
        onlyOwner
        returns (bool)
    {
        Active.ETH += msg.value;
        return true;
    }
    
    // Transfers the specified amount of ETH to _account and updates the total active collateral 
    function withdrawColl(uint _ETH, address payable _account)
        public
        onlyOwner
        returns (bool)
    {
        Active.ETH -= _ETH;
        _account.transfer(_ETH);
        
        return true;
    }
    
    // Issues the specified amount of CLV to _account and updates the total active debt
    function withdrawCLV(uint _CLV, address _account)
        public
        onlyOwner
        returns (bool)
    {
        Active.CLV += _CLV;
        CLV.mint(_account, _CLV);
                
        return true;
    }
    
    // Burns the specified amount of CLV from _account and updates the total active debt
    function repayCLV(uint _CLV, address _account)
        public
        onlyOwner
        returns (bool)
    {
        Active.CLV -= _CLV;
        CLV.burn(_account, _CLV);
        
        return true;
    }           
    
    // Updates the Active Pool and the Default Pool when a CDP gets closed
    function close(uint _CLV, uint _ETH)
        public
        onlyOwner
        returns (bool)
    {
        // Transfer the debt & coll from the Stability Pool to the Default Pool
        Default.CLV += _CLV;
        Default.ETH += _ETH;
        Active.CLV -= _CLV;
        Active.ETH -= _ETH;
        
        return true;
    }    
    
    // Updates the Active Pool and the Default Pool when a CDP obtains a default share
    function obtainDefaultShare(uint _CLV, uint _ETH)
        public
        onlyOwner
        returns (bool)
    {    
        // Transfer the debt & coll from the Default Pool to the Stability Pool
        Default.CLV -= _CLV;
        Default.ETH -= _ETH;
        Active.CLV += _CLV;
        Active.ETH += _ETH;
        
        return true;
    }
    
    // Burns the received CLV, transfers the redeemed ETH to _account and updates the Active Pool
    function redeemCollateral(uint _CLV, uint _ETH, address payable _account)
        public
        onlyOwner
        returns (bool)
    {    
        Active.CLV -= _CLV;
        Active.ETH -= _ETH;
        
        CLV.burn(_account, _CLV);
        _account.transfer(_ETH);
                
        return true;
    }    

    // Deposits the specified amount to the Stability Pool using the algorithm from http://batog.info/papers/scalable-reward-distribution.pdf
    // Can be called directly by anybody, not just by the owner (CDP contract) 
    // TODO: Support multiple deposits by the same address
    // TODO: CDP holders which make a deposit should be able to redirect the received ETH to their CDPs
    function depositCLV(uint _amount) 
        public
        returns (bool)
    {
        require(_amount > 0, "Deposited amount must be larger than 0");
        require(CLV.balanceOf(msg.sender) >= _amount, "Sender has insufficient balance");
        
        // Transfer the CLV tokens from the caller (msg.sender) to the pool's address and update the amount of CLV
        CLV.sendToPool(msg.sender, _amount);
        Stability.CLV += _amount;
        
        // Record the deposit made by the caller in a map
        deposit[msg.sender].CLV += _amount;
        
        // Record an individual snapshot of the running totals S_CLV and S_ETH for the caller (msg.sender)
        snapshot[msg.sender].CLV = S_CLV;
        snapshot[msg.sender].ETH = Stability.ETH;
        
        return true;
    }   
    
    // Cancels out the specified _debt against the CLV contained in the Stability Pool (as far as possible)  
    // and transfers the CDP's ETH collateral from Active Pool to Stability Pool. 
    // Returns the amount of debt & coll that could not be cancelled out.
    // Can only be called via the close(...) and closeCDPs(... ) functions in CDP.sol
    function offset(uint _debt, uint _coll)
        public
        payable
        onlyOwner
        returns (uint[2] memory) // Note: it would be nicer to return this as a struct, but struct returns are still experimental
    {    
        require(Stability.CLV > 0, "Stability pool is empty");
        
        // If the debt is larger than the deposited CLV, only offset an amount of debt corresponding to the latter
        uint debtToDistribute = getMin(_debt, Stability.CLV);
        // Determine the amount of collateral to be distributed in proportion to the debt that is distributed
        uint collToDistribute = (((debtToDistribute * digits) / _debt) * _coll) / digits;
        
        // Update the running total S_CLV by adding the ratio between the distributed debt and the CLV in the pool
        S_CLV += (debtToDistribute * digits) / Stability.CLV;
        // Update the running total S_ETH by adding the ratio between the distributed collateral and the ETH in the pool
        S_ETH += (collToDistribute * digits) / Stability.CLV;
        
        // Update the amount of ETH and CLV in the Stability Pool and the Active Pool
        Stability.ETH += collToDistribute; 
        Stability.CLV -= debtToDistribute;
        Active.ETH -= collToDistribute;
        Active.CLV -= debtToDistribute;
        
        // Burn the debt that was successfully offset
        CLV.burn(address(this), debtToDistribute);
        
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
        require(deposit[msg.sender].CLV > 0, "Caller has no deposit");
        
        // Calculate the CLV and ETH shares to be retrieved according http://batog.info/papers/scalable-reward-distribution.pdf
        // TODO: Check for div/0
        // Problem: Rounding errors lead to results like 666666666666666600 instead of 666666666666666666 
        uint CLVShare = deposit[msg.sender].CLV - (deposit[msg.sender].CLV * (S_CLV - snapshot[msg.sender].CLV)) / digits;
        uint ETHShare = (deposit[msg.sender].CLV * (S_ETH - snapshot[msg.sender].ETH)) / digits;
        
        // Updates the amounts of ETH and CLV in the Stability Pool and the Active Pool
        Stability.ETH -= ETHShare; 
        Stability.CLV -= CLVShare;

        deposit[msg.sender].CLV = 0;
        // TODO: Beware of rounding errors that may lead to underflows
        CLV.returnFromPool(msg.sender, getMin(CLVShare, Stability.CLV));
        
        // Return the ether to the caller
        msg.sender.transfer(ETHShare);
        
        return true;
    }
}    