pragma solidity 0.5.16;

import "./SafeMath.sol";
import "./console.sol";

library Math {
    using SafeMath for uint;

    // The virtual debt assigned to all troves. 
    uint constant virtualDebt = 6e18;
  
    function _min(uint _a, uint _b) internal pure returns (uint) {
        return (_a < _b) ? _a : _b;
    }

    function _max(uint _a, uint _b) internal pure returns (uint) {
        return (_a >= _b) ? _a : _b;
    }

    /* multiply two decimal numbers and use normal rounding rules:
    -round product up if 19th mantissa digit >= 5
    -round product down if 19th mantissa digit < 5
    */
    function decMul(uint x, uint y) internal pure returns (uint decProd) {
        uint prod_xy = x.mul(y);

        decProd = prod_xy.add(1e18 / 2).div(1e18);
    }

    /* Exponentiation function for 18-digit decimal base, and integer exponent n. 
    Uses the efficient "exponentiation by squaring" algorithm. O(log(n)) complexity. */
    function _decPow(uint _base, uint _n) internal pure returns (uint) {
        if (_n == 0) {return 1e18;}

        uint y = 1e18;

        while (_n > 1) {
            if (_n % 2 == 0) {
                _base = decMul(_base, _base);
                _n = _n.div(2);
            } else if (_n % 2 != 0) {
                y = decMul(_base, y);
                _base = decMul(_base, _base);
                _n = (_n.sub(1)).div(2);
            }
        }

        return decMul(_base, y);
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

