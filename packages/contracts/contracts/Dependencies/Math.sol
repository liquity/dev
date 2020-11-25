// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./SafeMath.sol";
//import "./console.sol";

library Math {
    using SafeMath for uint;

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

    /* _decPow: Exponentiation function for 18-digit decimal base, and integer exponent n. 
    Uses the efficient "exponentiation by squaring" algorithm. O(log(n)) complexity. 
    
    Called by two functions that represent time in units of minutes:
    1) CDPManager._calcDecayedBaseRate
    2) CommunityIssuance._getCumulativeIssuanceFraction 
    The exponent is capped avoid reverting due to overflow. The cap 525600000 equals
    "minutes in 1000 years": 60 * 24 * 365 * 1000
    
    If a period of > 1000 years is ever used as an expoenent in either of the above functions, the result will be
    negligibly different from just passing the cap:
    1) The decayed base rate will be 0 in either case
    2) The difference in tokens issued will be negligible.
    */
    function _decPow(uint _base, uint _minutes) internal pure returns (uint) {
       
        if (_minutes > 525600000) {_minutes = 525600000;}  // cap to avoid overflow
    
        if (_minutes == 0) {return 1e18;}

        uint y = 1e18;

        while (_minutes > 1) {
            if (_minutes % 2 == 0) {
                _base = decMul(_base, _base);
                _minutes = _minutes.div(2);
            } else if (_minutes % 2 != 0) {
                y = decMul(_base, y);
                _base = decMul(_base, _base);
                _minutes = (_minutes.sub(1)).div(2);
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
