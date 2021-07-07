// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./../Dependencies/SafeMath.sol";

contract PriceFormula {
    using SafeMath for uint256;

    function getSumFixedPoint(uint x, uint y, uint A) public pure returns(uint) {
        if(x == 0 && y == 0) return 0;

        uint sum = x.add(y);

        for(uint i = 0 ; i < 255 ; i++) {
            uint dP = sum;
            dP = dP.mul(sum) / (x.mul(2)).add(1);
            dP = dP.mul(sum) / (y.mul(2)).add(1);

            uint prevSum = sum;

            uint n = (A.mul(2).mul(x.add(y)).add(dP.mul(2))).mul(sum);
            uint d = (A.mul(2).sub(1).mul(sum));
            sum = n / d.add(dP.mul(3));

            if(sum <= prevSum.add(1) && prevSum <= sum.add(1)) break;
        }

        return sum;
    }

    function getReturn(uint xQty, uint xBalance, uint yBalance, uint A) public pure returns(uint) {
        uint sum = getSumFixedPoint(xBalance, yBalance, A);

        uint c = sum.mul(sum) / (xQty.add(xBalance)).mul(2);
        c = c.mul(sum) / A.mul(4);
        uint b = (xQty.add(xBalance)).add(sum / A.mul(2));
        uint yPrev = 0;
        uint y = sum;

        for(uint i = 0 ; i < 255 ; i++) {
            yPrev = y;
            uint n = (y.mul(y)).add(c);
            uint d = y.mul(2).add(b).sub(sum); 
            y = n / d;

            if(y <= yPrev.add(1) && yPrev.add(1) <= y) break;
        }

        return yBalance.sub(y).sub(1);
    }
}
