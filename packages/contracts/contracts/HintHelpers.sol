// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";

contract HintHelpers is LiquityBase, Ownable {

    ISortedTroves public sortedTroves;
    ITroveManager public troveManager;

    // --- Events ---

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _sortedTrovesAddress,
        address _troveManagerAddress
    )
        external
        onlyOwner
    {
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        troveManager = ITroveManager(_troveManagerAddress);

        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /* getRedemptionHints() - Helper function for redeemCollateral().
     *
     * Find the first and last Troves that will modified by calling redeemCollateral() with the same _LUSDamount and _price,
     * and return the address of the first one and the final ICR of the last one.
     */

    function getRedemptionHints(
        uint _LUSDamount, 
        uint _price
    )
        external
        view
        returns (address firstRedemptionHint, uint partialRedemptionHintICR)
    {
        uint remainingLUSD = _LUSDamount;
        address currentTroveuser = sortedTroves.getLast();

        while (currentTroveuser != address(0) && troveManager.getCurrentICR(currentTroveuser, _price) < MCR) {
            currentTroveuser = sortedTroves.getPrev(currentTroveuser);
        }

        firstRedemptionHint = currentTroveuser;

        while (currentTroveuser != address(0) && remainingLUSD > 0) {
            uint LUSDDebt = _getNetDebt(troveManager.getTroveDebt(currentTroveuser))
                                     .add(troveManager.getPendingLUSDDebtReward(currentTroveuser));

            if (LUSDDebt > remainingLUSD) {
                uint ETH = troveManager.getTroveColl(currentTroveuser)
                                     .add(troveManager.getPendingETHReward(currentTroveuser));
                
                uint newColl = ETH.sub(remainingLUSD.mul(1e18).div(_price));
                uint newDebt = LUSDDebt.sub(remainingLUSD);
                
                uint compositeDebt = _getCompositeDebt(newDebt);
                partialRedemptionHintICR = LiquityMath._computeCR(newColl, compositeDebt, _price);

                break;
            } else {
                remainingLUSD = remainingLUSD.sub(LUSDDebt);
            }
            currentTroveuser = sortedTroves.getPrev(currentTroveuser);
        }
    }

    /* getApproxHint() - return address of a Trove that is, on average, (length / numTrials) positions away in the 
    sortedTroves list from the correct insert position of the Trove to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(uint _CR, uint _numTrials, uint _price, uint _inputRandomSeed)
        external
        view
        returns (address hintAddress, uint diff, uint latestRandomSeed)
    {
        uint arrayLength = troveManager.getTroveOwnersCount();

        if (arrayLength == 0) {
            return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = sortedTroves.getLast();
        diff = LiquityMath._getAbsoluteDifference(_CR, troveManager.getCurrentICR(hintAddress, _price));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = troveManager.getTroveFromTroveOwnersArray(arrayIndex);
            uint currentICR = troveManager.getCurrentICR(currentAddress, _price);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = LiquityMath._getAbsoluteDifference(currentICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    }

    function computeCR(uint _coll, uint _debt, uint _price) external pure returns (uint) {
        return LiquityMath._computeCR(_coll, _debt, _price);
    }
}
