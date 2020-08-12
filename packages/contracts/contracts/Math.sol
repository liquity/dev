pragma solidity 0.5.16;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/console.sol";

library Math {
    using SafeMath for uint;

    // The virtual debt assigned to all troves.  Needed for preserving collateral for
    uint constant virtualDebt = 6e18;
  
    function _min(uint _a, uint _b) internal pure returns (uint) {
        return (_a < _b) ? _a : _b;
    }

    function _max(uint _a, uint _b) internal pure returns (uint) {
        return (_a >= _b) ? _a : _b;
    }

    /* Converts the magnitude of an int to a uint
    TODO:  check validity for num in region (num > 2**255) or (num < -(2**255) ) */
    function _intToUint(int _num) internal pure returns (uint) {
        return (_num >= 0) ? uint(_num) : uint(-_num); 
    }

    function _getAbsoluteDifference(uint _a, uint _b) internal pure returns (uint) {
        return (_a >= _b) ? _a.sub(_b) : _b.sub(_a);
    }

    function _computeCR(uint _coll, uint _debt, uint _price) internal pure returns (uint) {
        if (_debt > 0) {
            uint newCollRatio = _coll.mul(_price).div(_debt);

            return newCollRatio;
        }
        // Return the maximal value for uint256 if the CDP has a debt of 0
        else if (_debt == 0) {
            return 2**256 - 1; 
        }
    }

}

