pragma solidity 0.5.16;

import "./Interfaces/ICDPManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedCDPs.sol";
import "./Math.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";

contract HintHelpers is Ownable {
    using SafeMath for uint;

    uint constant public MIN_VIRTUAL_DEBT = 10e18;   // The minimum virtual debt assigned to all troves: 10 CLV.  TODO: extract to base contract
    uint constant public MCR = 1100000000000000000; // Minimal collateral ratio.

    IPriceFeed public priceFeed;
    address public priceFeedAddress;

    ISortedCDPs public sortedCDPs;
    address public sortedCDPsAddress;

    ICDPManager public cdpManager;
    address public cdpManagerAddress;

    // --- Events ---

    event PriceFeedAddressChanged(address _priceFeedAddress);
    event SortedCDPsAddressChanged(address _sortedCDPsAddress);
    event CDPManagerAddressChanged(address _cdpManagerAddress);

    // --- Dependency setters ---

    function setPriceFeed(address _priceFeedAddress) external onlyOwner {
        priceFeedAddress = _priceFeedAddress;
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
        uint arrayLength = cdpManager.getallTrovesArrayCount();
        require(arrayLength >= 1, "CDPManager: sortedList must not be empty");
        uint price = priceFeed.getPrice();
        address hintAddress = sortedCDPs.getLast();
        uint closestICR = cdpManager.getCurrentICR(hintAddress, price);
        uint diff = Math._getAbsoluteDifference(_CR, closestICR);
        uint i = 1;

        while (i < _numTrials) {
            uint arrayIndex = _getRandomArrayIndex(block.timestamp.add(i), arrayLength);
            address currentAddress = cdpManager.getTroveFromAllTrovesArray(arrayIndex);
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

    // TODO: extract to common base contract
   // Returns the ETH amount that is equal, in $USD value, to the minVirtualDebt 
    function _getMinVirtualDebtInETH(uint _price) internal pure returns (uint minETHComp) {
        minETHComp = MIN_VIRTUAL_DEBT.mul(1e18).div(_price);
        return minETHComp;
    }

    // Returns the composite debt (actual debt + virtual debt) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        // return _debt.add(minVirtualDebt);
        return _debt;
    }
}