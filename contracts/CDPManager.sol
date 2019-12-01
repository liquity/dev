pragma solidity >0.5.0;

// TODO: Use SafeMath
import "./Token.sol";
import "./PriceFeed.sol";
import "./SortedDoublyLL.sol";
import "./PoolManager.sol";

contract CDPManager {
    using SortedDoublyLL for SortedDoublyLL.Data;
    address owner;
    string name;
    uint constant DIGITS = 1e18; // Number of digits used for precision, e.g. when calculating redistribution shares. Equals "ether" unit.
    uint constant MCR = (11 * DIGITS) / 10; // Minimal collateral ratio (e.g. 110%). TODO: Allow variable MCR
    uint constant MAX_DRAWDOWN = 20; // Loans cannot be drawn down more than 5% (= 1/20) below the TCR when receiving redistribution shares
    enum Status { inexistent, active, closed }
    
    // Three default CDPs for debugging
    address constant CDP1 = 0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c;
    address constant CDP2 = 0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C;
    address constant CDP3 = 0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB;
    
    // Stores the necessary data for a Collateralized Debt Position (CDP)
    struct CDP {
        uint debt;
        uint coll;
        uint ICR; // Individual Collateral Ratio
        Status status;
    }
    
    mapping (address => CDP) public CDPs; // A map of all existing (active and closed) CDPs
    SortedDoublyLL.Data public sortedCDPs; // A doubly linked CDP list sorted by the collateral ratio of the CDPs
    
    // Declare the Token and the PriceFeed contracts and their addresses
    CLVToken CLV; 
    ETHPriceFeed PriceFeed;
    PoolManager Pools;
    address public CLVAddress;
    address public PriceFeedAddress;
    address public PoolAddress;
       
    // Register the owner and the name of the CDP contract and install other contracts
    
    // TODO: move the contract creation to Master.sol and replace this constructor by
    // constructor(uint _digits, address _CLV, address _Pool, address _PriceFeed)   
    constructor() 
        public  
        payable
    {
        owner = msg.sender;
       
        // Create the CLV token contract
        CLV = new CLVToken("CLV");
        CLVAddress = address(CLV);
        
        // Create the ETHPriceFeed contract
        PriceFeed = new ETHPriceFeed(DIGITS);
        PriceFeedAddress = address(PriceFeed);
         
        // Create the StabilityPool contract
        Pools = new PoolManager(DIGITS, PriceFeedAddress, CLVAddress);
        PoolAddress = address(Pools);
        
        CLV.registerPool(PoolAddress);
        
        // Set maximum size for sortedCDPs
        sortedCDPs.setMaxSize(1000000);

        // Create and initialize some example CDPs as a test scenario
        uint CDP1_debt = 400; uint CDP1_coll = 5 ether;
        uint CDP2_debt = 200; uint CDP2_coll = 2 ether;
        uint CDP3_debt = 210; uint CDP3_coll = 1 ether; // Undercollateralized!
        
        // Total debt at the start = 810000000000000000000
        // Total coll at the start = 8000000000000000000
        
        // CDP 1
        CDPs[CDP1].status = Status.active;
        CDPs[CDP1].coll = CDP1_coll;
        CDPs[CDP1].debt = CDP1_debt * 1e18;
        Pools.initializeCDP.value(CDP1_coll)(CDP1, CDP1_debt * 1e18);
        sortedCDPs.insert(CDP1, getCollRatio(CDP1), CDP1, CDP1);
    
        // CDP 2
        CDPs[CDP2].status = Status.active;
        CDPs[CDP2].coll = CDP2_coll;
        CDPs[CDP2].debt = CDP2_debt * 1e18;
        Pools.initializeCDP.value(CDP2_coll)(CDP2, CDP2_debt * 1e18);
        sortedCDPs.insert(CDP2, getCollRatio(CDP2), CDP1, CDP1);
        
        // CDP 3
        CDPs[CDP3].status = Status.active;
        CDPs[CDP3].coll = CDP3_coll;
        CDPs[CDP3].debt = CDP3_debt * 1e18;
        Pools.initializeCDP.value(CDP3_coll)(CDP3, CDP3_debt * 1e18);
        sortedCDPs.insert(CDP3, getCollRatio(CDP3), CDP1, CDP1);
        
        // CDP 1 transfers all CLV tokens to address 0x583031D1113aD414F02576BD6afaBfb302140225
        Pools.transferCLV(CDP1, 0x583031D1113aD414F02576BD6afaBfb302140225, CDP1_debt * 1e18);
        
        // CDP 2 transfers all CLV tokens to address 0xdD870fA1b7C4700F2BD7f44238821C26f7392148
        Pools.transferCLV(CDP2, 0xdD870fA1b7C4700F2BD7f44238821C26f7392148, CDP2_debt * 1e18);
    }   
        
    // Returns the new collateral ratio considering the debt and/or colleral that should be added or removed 
    function getNewCollRatio(address _debtor, uint _debt_change, uint _coll_change) 
        view 
        internal 
        returns (uint) 
    {
        // Check if the total debt is higher than 0 to avoid division by 0
        if (CDPs[_debtor].debt + _debt_change > 0) {
            return (CDPs[_debtor].coll + _coll_change) * PriceFeed.getPrice() / (CDPs[_debtor].debt + _debt_change);
        }
        // Return the maximal vale for uint256 if the CDP has a debt of 0
        else {
            return 2**256-1; 
        }
    }
    
    // Returns the current collateral ratio of a specified CDP
    function getCollRatio(address _debtor) 
        view 
        public 
        returns (uint) 
    {
        return getNewCollRatio(_debtor, 0, 0);
    }
    
    // Create a new CDP
    function create() 
        public
        returns (bool) 
    {
        require(CDPs[msg.sender].status == Status.inexistent, "CDP already exists");
        
        CDPs[msg.sender].status = Status.active; 
        sortedCDPs.insert(msg.sender, getCollRatio(msg.sender), CDP1, CDP1);
        
        return true;
    }
    
    // Pay a given number of ETH (msg.value) as collateral to a CDP 
    function addColl() 
        public 
        payable 
        returns (bool) 
    {
        // Potential issue with using msg.sender as the key in the CDPs map: Users may not be able interact via other contracts since the 
        // msg.sender would then be the contract rather than the transacting user. Beware of tx.origin.
        require(CDPs[msg.sender].status != Status.closed, "CDP is closed");
        
        // Create a CDP if it does not exist yet
        if (CDPs[msg.sender].status == Status.inexistent) {
            create();
        }
        
        // Add the received collateral to the CDP and calculate the new collateral ratio
        CDPs[msg.sender].coll += msg.value;
        
        // Add the received collateral to the ActivePool (note that transfer() does not work as it restricts gas usage to 2300)
        Pools.addColl.value(msg.value)();
        
        // Update entry in sortedCDPs
        sortedCDPs.updateKey(msg.sender, getCollRatio(msg.sender), CDP1, CDP1);
        
        return true;
    }
    
    // Withdraw ETH collateral from a CDP
    // TODO: Check re-entrancy protection
    function withdrawColl(uint _amount) 
        public 
        returns (bool) 
    {
        require(CDPs[msg.sender].status == Status.active, "CDP does not exist or is closed");
        require(CDPs[msg.sender].coll >= _amount, "Insufficient balance for ETH withdrawal");
        require(getNewCollRatio(msg.sender, 0, -_amount) >= MCR, "Insufficient collateral ratio for ETH withdrawal");
        
        // Reduce the ETH collateral by _amount
        CDPs[msg.sender].coll -= _amount;
        
        // Update entry in sortedCDPs
        sortedCDPs.updateKey(msg.sender, getCollRatio(msg.sender), CDP1, CDP1);
        
        // Remove _amount ETH from ActivePool and send it to the CDP owner (msg.sender)
        Pools.withdrawColl(_amount, msg.sender);
        
        return true;
    }
    
    // Withdraw CLV tokens from a CDP: Mint new CLV and increase the debt accordingly
    function withdrawCLV(uint _amount) 
        public 
        returns (bool) 
    {
        require(CDPs[msg.sender].status == Status.active, "CDP does not exist or is closed");
        require(_amount > 0, "Amount to withdraw must be larger than 0");
        require(getNewCollRatio(msg.sender, _amount, 0) >= MCR, "Insufficient collateral ratio for CLV withdrawal");
        
        // Increase the debt by the withdrawn amount of CLV
        CDPs[msg.sender].debt += _amount;

        // Mint the given amount of CLV, add them to the ActivePool and send them to CDP owner's address 
        Pools.withdrawCLV(_amount, msg.sender);
        
        // Update entry in sortedCDPs
        sortedCDPs.updateKey(msg.sender, getCollRatio(msg.sender), CDP1, CDP1);
        
        return true; 
    }
    
    // Repay CLV tokens to a CDP: Burn the repaid CLV tokens and reduce the debt accordingly
    function repayCLV(uint _amount) 
        public 
        returns (bool) 
    {
        require(CDPs[msg.sender].status == Status.active, "CDP does not exist or is closed");
        require(_amount > 0, "Repaid amount must be larger than 0");
        require(_amount <= CDPs[msg.sender].debt, "Repaid amount is larger than current debt");
        require(CLV.balanceOf(msg.sender) >= _amount, "Sender has insufficient balance");
        // TODO: Maybe allow foreign accounts to repay loans
        
        // Reduce the debt and calculate the new collateral ratio
        CDPs[msg.sender].debt -= _amount;
        
        // Burn the received amount of CLV and remove them from the ActivePool
        Pools.repayCLV(_amount, msg.sender);

        // Update entry in sortedCDPs
        sortedCDPs.updateKey(msg.sender, getCollRatio(msg.sender), CDP1, CDP1);
        
        return true;
    }

    // Closes the CDP of the speficied _debtor if its individual collateral ratio is lower than the minimum collateral ratio.
    // TODO: This function should eventually be internal and only be called by closeCDPs(...). 
    function close(address _debtor) 
        public 
        returns (bool) 
    {
        require(CDPs[_debtor].status == Status.active, "CDP does not exist or is already closed");
        require(getCollRatio(_debtor) < MCR, "CDP not undercollateralized");
        
        // Offset as much debt & collateral as possible against the StabilityPool and save the returned remainders
        uint[2] memory remainder = Pools.offset(CDPs[_debtor].debt, CDPs[_debtor].coll);
        if (remainder[0] > 0) {
            // If the debt could not be offset entirely, transfer the remaining debt & collateral from Active Pool to Default Pool 
            // Note: remainder[0] = remaining debt; remainder[1] = remaining collateral;
            Pools.close(remainder[0], remainder[1]);
        }
        
        // Close the CDP
        CDPs[_debtor].status = Status.closed;
        
        // Remove CDP from sortedCDPs
        sortedCDPs.remove(_debtor);
        
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
            
            // Close CDPs if it is undercollateralized
            if (getCollRatio(currentCDP) < MCR) {
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
    function obtainDefaultShare(address _recipient, uint _debt) 
        public 
        returns (bool) 
    {
        require(CDPs[_recipient].status == Status.active, "Recipient must own an active CDP");
        require(_debt <= Pools.closedDebt(), "Debt in the default pool smaller than the speficied debt share");
        
        uint coll = (_debt * Pools.closedColl()) / Pools.closedDebt(); // Calculate collateral share coll from _debt
        require(getNewCollRatio(_recipient, _debt, coll) > Pools.getTCR() - Pools.getTCR() / MAX_DRAWDOWN, "Collateral ratio would be drawn below maximum drawdown");
        
        // Add debt & coll share to the CDP and to the total and remove them from the default pool
        CDPs[_recipient].debt += _debt;
        CDPs[_recipient].coll += coll;
        
        Pools.obtainDefaultShare(_debt, coll);
        
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
        require(CLV.balanceOf(msg.sender) >= _amount, "Sender has insufficient balance");
        uint redeemed;
        
        // Loop through the CDPs starting from the one with lowest collateral ratio until _amount of CLV is exchanged for collateral
        while (redeemed < _amount) {
            address currentCDP = sortedCDPs.getLast();
            
            // Close CDPs along the way that turn out to be undercollateralized
            if (getCollRatio(currentCDP) < MCR) {
                close(currentCDP);
            }
            else {
                // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the current CDP 
                uint lot = getMin(_amount - redeemed, CDPs[currentCDP].debt);
                    
                // Decrease the debt and collateral of the current CDP according to the lot
                CDPs[currentCDP].debt -= lot;
                CDPs[currentCDP].coll -= (lot * DIGITS) / PriceFeed.getPrice();

                // Burn the calculated lot of CLV and send the corresponding ETH to msg.sender
                Pools.redeemCollateral(lot, (lot * DIGITS) / PriceFeed.getPrice(), msg.sender);

                // Break the loop if there is no more active debt to redeem 
                if (Pools.activeDebt() == 0) break;    
                    
                // Update the sortedCDPs list and the redeemed amount
                sortedCDPs.updateKey(currentCDP, getCollRatio(currentCDP), CDP1, CDP1); 
                
                redeemed += lot;
                
            }
            
        }
    }    
}