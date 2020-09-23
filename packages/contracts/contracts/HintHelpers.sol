pragma solidity 0.5.16;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";

contract HintHelpers is LiquityBase, Ownable {

    // @REVIEW: We already have these variables in LiquityBase
    uint constant public MIN_VIRTUAL_DEBT = 10e18;   // The minimum virtual debt assigned to all troves: 10 CLV.  TODO: extract to base contract
    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.

    IPriceFeed public priceFeed;
    // @REVIEW: Do we need this?
    address public priceFeedAddress;

    ISortedCDPs public sortedCDPs;
    // @REVIEW: Do we need this?
    address public sortedCDPsAddress;

    ICDPManager public cdpManager;
    // @REVIEW: Do we need this?
    address public cdpManagerAddress;

    // --- Events ---

    event PriceFeedAddressChanged(address _priceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Dependency setters ---

    function setPriceFeed(address _priceFeedAddress) external onlyOwner {
        priceFeedAddress = _priceFeedAddress;
        // @REVIEW: It’s cheaper to use the param, like in the setters below
        priceFeed = IPriceFeed(priceFeedAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
    }

    function setSortedCDPs(address _sortedCDPsAddress) external onlyOwner {
        sortedCDPsAddress = _sortedCDPsAddress;
        sortedCDPs = ISortedCDPs(_sortedCDPsAddress);
        emit SortedCDPsAddressChanged(_sortedCDPsAddress);
    }

    function setCDPManager(address _cdpManagerAddress) external onlyOwner {
        cdpManagerAddress = _cdpManagerAddress;
        cdpManager = ICDPManager(_cdpManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
    }

    // --- Functions ---

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

        while (currentCDPuser != address(0) && cdpManager.getCurrentICR(currentCDPuser, _price) < MCR) {
            currentCDPuser = sortedCDPs.getPrev(currentCDPuser);
        }

        firstRedemptionHint = currentCDPuser;

        while (currentCDPuser != address(0) && remainingCLV > 0) {
            uint CLVDebt = cdpManager.getCDPDebt(currentCDPuser)
                                     .add(cdpManager.getPendingCLVDebtReward(currentCDPuser));

            if (CLVDebt > remainingCLV) {
                uint ETH = cdpManager.getCDPColl(currentCDPuser)
                                     .add(cdpManager.getPendingETHReward(currentCDPuser));
                // @REVIEW: Are we sure we want to use SafeMath’s div? Solidity already asserts when dividing by zero.
                uint newColl = ETH.sub(remainingCLV.mul(1e18).div(_price));

                uint newDebt = CLVDebt.sub(remainingCLV);
                uint compositeDebt = _getCompositeDebt(newDebt);

                partialRedemptionHintICR = Math._computeCR(newColl, compositeDebt, _price);

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
        uint arrayLength = cdpManager.getCDPOwnersCount();
        if (arrayLength == 0 ) { return address(0); } 

        uint price = priceFeed.getPrice();
        address hintAddress = sortedCDPs.getLast();
        uint closestICR = cdpManager.getCurrentICR(hintAddress, price);
        uint diff = Math._getAbsoluteDifference(_CR, closestICR);
        uint i = 1;

        while (i < _numTrials) {
            uint arrayIndex = _getRandomArrayIndex(block.timestamp.add(i), arrayLength);
            address currentAddress = cdpManager.getTroveFromCDPOwnersArray(arrayIndex);
            uint currentICR = cdpManager.getCurrentICR(currentAddress, price);

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

    function computeCR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return Math._computeCR(_coll, _debt, _price);
    }
}