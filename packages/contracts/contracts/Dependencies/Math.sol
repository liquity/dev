pragma solidity 0.5.16;

import "./SafeMath.sol";
import "./console.sol";

library Math {
    using SafeMath for uint;

    // The virtual debt assigned to all troves. Needed for preserving collateral for
    uint constant virtualDebt = 6e18;
  
    function _min(uint _a, uint _b) internal pure returns (uint) {
        return (_a < _b) ? _a : _b;
    }

    function _max(uint _a, uint _b) internal pure returns (uint) {
        return (_a >= _b) ? _a : _b;
    }

    /* Exponentiation function for 18-digit decimal base, and integer exponent n. 
    Uses the efficient "exponentiation by squaring" algorithm. O(log(n)) complexity. */
    function decPow(uint _base, uint _n) internal pure returns (uint) {
        if (_n == 0) {return 1e18;}

        uint y = 1e18;

        while (_n > 1) {
            if (_n % 2 == 0) {
                _base = _base.mul(_base).div(1e18);
                _n = _n.div(2);
            } else if (_n % 2 != 0) {
                y = _base.mul(y).div(1e18);
                _base = _base.mul(_base).div(1e18);
                _n = (_n.sub(1)).div(2);
            }
        }

        return _base.mul(y).div(1e18);
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

