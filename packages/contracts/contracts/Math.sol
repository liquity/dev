pragma solidity ^0.5.16;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/console.sol";

library Math {
    using SafeMath for uint;
    function _min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }

    /* Converts the magnitude of an int to a uint
    TODO:  check validity for num in region (num > 2**255) or (num < -(2**255) ) */
    function _intToUint(int num) internal pure returns (uint) {
        if (num < 0) {
            return uint(-num);
        } else if (num >= 0) {
            return uint(num);
        }
    }

    function _getAbsoluteDifference(uint _a, uint _b) internal pure returns (uint) {
        if (_a >= _b) {
            return _a.sub(_b);
        } else if (_a < _b) {
            return _b.sub(_a);
        }
    }

    function _computeICR(uint _coll, uint _debt, uint _price) internal pure returns (uint) {
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

