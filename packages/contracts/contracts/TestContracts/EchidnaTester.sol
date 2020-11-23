// SPDX-License-Identifier: MIT

pragma solidity ^0.6.11;

import "../CDPManager.sol";
import "../BorrowerOperations.sol";
import "../ActivePool.sol";
import "../DefaultPool.sol";
import "../StabilityPool.sol";
import "../CLVToken.sol";
import "../PriceFeed.sol";
import "../SortedCDPs.sol";
import "./EchidnaProxy.sol";
//import "../Dependencies/console.sol";

// Run with:
// rm -f fuzzTests/corpus/* # (optional)
// ~/.local/bin/echidna-test contracts/TestContracts/EchidnaTester.sol --contract EchidnaTester --config fuzzTests/echidna_config.yaml

contract EchidnaTester {
    using SafeMath for uint;

    uint constant private NUMBER_OF_ACTORS = 100;
    uint constant private INITIAL_BALANCE = 1e24;
    uint private MCR;
    uint private CCR;
    uint private CLV_GAS_COMPENSATION;
    address public GAS_POOL_ADDRESS;

    CDPManager public cdpManager;
    BorrowerOperations public borrowerOperations;
    ActivePool public activePool;
    DefaultPool public defaultPool;
    StabilityPool public stabilityPool;
    CLVToken public clvToken;
    PriceFeed priceFeed;
    SortedCDPs sortedCDPs;

    EchidnaProxy[NUMBER_OF_ACTORS] public echidnaProxies;

    uint private numberOfTroves;

    constructor() public payable {
        cdpManager = new CDPManager();
        borrowerOperations = new BorrowerOperations();
        activePool = new ActivePool();
        defaultPool = new DefaultPool();
        stabilityPool = new StabilityPool();
        clvToken = new CLVToken(
            address(cdpManager),
            address(stabilityPool),
            address(borrowerOperations)
        );
        priceFeed = new PriceFeed();
        sortedCDPs = new SortedCDPs();

        // TODO
        cdpManager.setAddresses(address(borrowerOperations), address(activePool), address(defaultPool), address(stabilityPool), address(priceFeed), address(clvToken), address(sortedCDPs), address(0));
        
        // TODO
        borrowerOperations.setAddresses(address(cdpManager), address(activePool), address(defaultPool), address(priceFeed), address(sortedCDPs), address(clvToken), address(0));
        activePool.setAddresses(address(borrowerOperations), address(cdpManager), address(stabilityPool), address(defaultPool));
        defaultPool.setAddresses(address(cdpManager), address(activePool));
        
        // TODO
        stabilityPool.setAddresses(address(borrowerOperations), address(cdpManager), address(activePool), address(clvToken), address(0));
        priceFeed.setAddresses(address(cdpManager), address(0), address(0));
        sortedCDPs.setParams(1e18, address(cdpManager), address(borrowerOperations));

        for (uint i = 0; i < NUMBER_OF_ACTORS; i++) {
            echidnaProxies[i] = new EchidnaProxy(cdpManager, borrowerOperations, stabilityPool, clvToken);
            (bool success, ) = address(echidnaProxies[i]).call{value: INITIAL_BALANCE}("");
            require(success);
        }

        MCR = borrowerOperations.MCR();
        CCR = borrowerOperations.CCR();
        CLV_GAS_COMPENSATION = borrowerOperations.CLV_GAS_COMPENSATION();
        require(MCR > 0);
        require(CCR > 0);

        GAS_POOL_ADDRESS = cdpManager.GAS_POOL_ADDRESS();

        // TODO:
        priceFeed.setPrice(1e22);
    }

    // CDPManager

    function liquidateExt(uint _i, address _user) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidatePrx(_user);
    }

    function liquidateCDPsExt(uint _i, uint _n) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidateCDPsPrx(_n);
    }

    function batchLiquidateTrovesExt(uint _i, address[] calldata _troveArray) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].batchLiquidateTrovesPrx(_troveArray);
    }

    function redeemCollateralExt(
        uint _i,
        uint _CLVAmount,
        address _firstRedemptionHint,
        address _partialRedemptionHint,
        uint _partialRedemptionHintICR
    ) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].redeemCollateralPrx(_CLVAmount, _firstRedemptionHint, _partialRedemptionHint, _partialRedemptionHintICR, 0);
    }

    // Borrower Operations

    function getAdjustedETH(uint actorBalance, uint _ETH, uint ratio) internal view returns (uint) {
        uint price = priceFeed.getPrice();
        require(price > 0);
        uint minETH = ratio.mul(CLV_GAS_COMPENSATION).div(price);
        require(actorBalance > minETH);
        uint ETH = minETH + _ETH % (actorBalance - minETH);
        return ETH;
    }

    function getAdjustedCLV(uint ETH, uint _CLVAmount, uint ratio) internal view returns (uint) {
        uint price = priceFeed.getPrice();
        uint CLVAmount = _CLVAmount;
        uint compositeDebt = CLVAmount.add(CLV_GAS_COMPENSATION);
        uint ICR = Math._computeCR(ETH, compositeDebt, price);
        if (ICR < ratio) {
            compositeDebt = ETH.mul(price).div(ratio);
            CLVAmount = compositeDebt.sub(CLV_GAS_COMPENSATION);
        }
        return CLVAmount;
    }

    function openLoanExt(uint _i, uint _ETH, uint _CLVAmount) public payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        // we pass in CCR instead of MCR in case it’s the first one
        uint ETH = getAdjustedETH(actorBalance, _ETH, CCR);
        uint CLVAmount = getAdjustedCLV(ETH, _CLVAmount, CCR);

        //console.log('ETH', ETH);
        //console.log('CLVAmount', CLVAmount);

        echidnaProxy.openLoanPrx(ETH, CLVAmount, address(0));

        numberOfTroves = cdpManager.getCDPOwnersCount();
        assert(numberOfTroves > 0);
        // canary
        //assert(numberOfTroves == 0);
    }

    function openLoanRawExt(uint _i, uint _ETH, uint _CLVAmount, address _hint) public payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].openLoanPrx(_ETH, _CLVAmount, _hint);
    }

    function addCollExt(uint _i, uint _ETH, address _user) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        uint ETH = getAdjustedETH(actorBalance, _ETH, MCR);

        echidnaProxy.addCollPrx(ETH, _user, address(0));
    }

    function addCollRawExt(uint _i, uint _ETH, address _user, address _hint) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].addCollPrx(_ETH, _user, _hint);
    }

    function withdrawCollExt(uint _i, uint _amount, address _hint) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawCollPrx(_amount, _hint);
    }

    function withdrawCLVExt(uint _i, uint _amount, address _hint) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawCLVPrx(_amount, _hint);
    }

    function repayCLVExt(uint _i, uint _amount, address _hint) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].repayCLVPrx(_amount, _hint);
    }

    function closeLoanExt(uint _i) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].closeLoanPrx();
    }

    function adjustLoanExt(uint _i, uint _ETH, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint actorBalance = address(echidnaProxy).balance;

        uint ETH = getAdjustedETH(actorBalance, _ETH, MCR);
        uint debtChange = _debtChange;
        if (_isDebtIncrease) {
            // TODO: add current amount already withdrawn:
            debtChange = getAdjustedCLV(ETH, uint(_debtChange), MCR);
        }
        // TODO: collWithdrawal, debtChange
        echidnaProxy.adjustLoanPrx(ETH, _collWithdrawal, debtChange, _isDebtIncrease, address(0));
    }

    function adjustLoanRawExt(uint _i, uint _ETH, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _hint) external payable {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].adjustLoanPrx(_ETH, _collWithdrawal, _debtChange, _isDebtIncrease, _hint);
    }

    // Pool Manager

    function provideToSPExt(uint _i, uint _amount, address _frontEndTag) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].provideToSPPrx(_amount, _frontEndTag);
    }

    function withdrawFromSPExt(uint _i, uint _amount) external {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawFromSPPrx(_amount);
    }

    // CLV Token

    function transferExt(uint _i, address recipient, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].transferPrx(recipient, amount);
    }

    function approveExt(uint _i, address spender, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].approvePrx(spender, amount);
    }

    function transferFromExt(uint _i, address sender, address recipient, uint256 amount) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].transferFromPrx(sender, recipient, amount);
    }

    function increaseAllowanceExt(uint _i, address spender, uint256 addedValue) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].increaseAllowancePrx(spender, addedValue);
    }

    function decreaseAllowanceExt(uint _i, address spender, uint256 subtractedValue) external returns (bool) {
        uint actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].decreaseAllowancePrx(spender, subtractedValue);
    }

    // PriceFeed

    function setPriceExt(uint256 _price) external {
        bool result = priceFeed.setPrice(_price);
        assert(result);
    }

    // --------------------------
    // Invariants and properties
    // --------------------------

    function echidna_canary_number_of_troves() public view returns(bool) {
        if (numberOfTroves > 20) {
            return false;
        }

        return true;
    }

    function echidna_canary_active_pool_balance() public view returns(bool) {
        if (address(activePool).balance > 0) {
            return false;
        }
        return true;
    }

    function echidna_troves_order() external view returns(bool) {
        uint price = priceFeed.getPrice();

        address currentTrove = sortedCDPs.getFirst();
        address nextTrove = sortedCDPs.getNext(currentTrove);

        while (currentTrove != address(0) && nextTrove != address(0)) {
            if (cdpManager.getCurrentICR(nextTrove, price) > cdpManager.getCurrentICR(currentTrove, price)) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentTrove = nextTrove;
            nextTrove = sortedCDPs.getNext(currentTrove);
        }

        return true;
    }

    /**
     * Status
     * Minimum debt (gas compensation)
     * Stake > 0
     */
    function echidna_trove_properties() public view returns(bool) {
        address currentTrove = sortedCDPs.getFirst();
        while (currentTrove != address(0)) {
            // Status
            if (CDPManager.Status(cdpManager.getCDPStatus(currentTrove)) != CDPManager.Status.active) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Minimum debt (gas compensation)
            if (cdpManager.getCDPDebt(currentTrove) < CLV_GAS_COMPENSATION) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Stake > 0
            if (cdpManager.getCDPStake(currentTrove) == 0) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentTrove = sortedCDPs.getNext(currentTrove);
        }
        return true;
    }

    function echidna_ETH_balances() public view returns(bool) {
        if (address(cdpManager).balance > 0) {
            return false;
        }

        if (address(borrowerOperations).balance > 0) {
            return false;
        }

        if (address(activePool).balance != activePool.getETH()) {
            return false;
        }

        if (address(defaultPool).balance != defaultPool.getETH()) {
            return false;
        }

        if (address(stabilityPool).balance != stabilityPool.getETH()) {
            return false;
        }

        if (address(clvToken).balance > 0) {
            return false;
        }

        if (address(priceFeed).balance > 0) {
            return false;
        }

        if (address(sortedCDPs).balance > 0) {
            return false;
        }

        return true;
    }

    // TODO: What should we do with this? Should it be allowed? Should it be a canary?
    function echidna_price() public view returns(bool) {
        uint price = priceFeed.getPrice();
        if (price == 0) {
            return false;
        }
        // Uncomment to check that the condition is meaningful
        //else return false;

        return true;
    }

    // total CLV matches
    function echidna_CLV_global_balances() public view returns(bool) {
        uint totalSupply = clvToken.totalSupply();
        uint gasPoolBalance = clvToken.balanceOf(GAS_POOL_ADDRESS);

        uint activePoolBalance = activePool.getCLVDebt();
        uint defaultPoolBalance = defaultPool.getCLVDebt();
        if (totalSupply != activePoolBalance + defaultPoolBalance) {
            return false;
        }

        uint stabilityPoolBalance = stabilityPool.getTotalCLVDeposits();
        address currentTrove = sortedCDPs.getFirst();
        uint trovesBalance;
        while (currentTrove != address(0)) {
            trovesBalance += clvToken.balanceOf(address(currentTrove));
            currentTrove = sortedCDPs.getNext(currentTrove);
        }
        // we cannot state equality because tranfers are made to external addresses too
        if (totalSupply <= stabilityPoolBalance + trovesBalance + gasPoolBalance) {
            return false;
        }

        return true;
    }

    /*
    function echidna_test() public view returns(bool) {
        return true;
    }
    */
}
