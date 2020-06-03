pragma solidity ^0.5.15;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@nomiclabs/buidler/console.sol";

library DeciMath {
    /* 
    DeciMath functions use the concept of a 'duint':
    
    A duint is a uint representation of an 18DP decimal number. The right-most 
    18 digits correspond to the mantissa, i.e. the digits after the decimal point. 

    Examples:
       1000000000000000000   represents 1
       5432100000000000000   represents 5.4321
               34560000000   represents 0.00000003456
     370000000000000000000   represents 370
                         1   represents 1e-18

     etc. 
    */

    uint constant _1E18 = 10**18;
    uint constant _1E17 = 10**17;
    uint constant _5E17 = 5*(10**17);

    // --- Accurate decimal math functions ---

    /* Accurately calculate (x * y) / z. Converts all arguments to 'duints', performs 
    calculations, then converts the result back to uint before returning. */
    // function accurateMulDiv(uint x, uint y, uint z) internal view returns (uint fraction) {
    //     require( z!= 0, "DeciMath: can not divide by zero");
    // // convert all uint to duint
    //     uint x_duint = toDuint(x);
    //     uint y_duint = toDuint(y);
    //     uint z_duint = toDuint(z);

    //     //  (x * y).  If y is guaranteed to be an integer (i.e. not duint) could use normalMul(x_duint, y) here to save gas.
    //     uint prod_duint = decMul(x_duint, y_duint); 
    //     // (x* y) / z
    //     uint res_duint = decDiv(prod_duint, z_duint);   

    //     // convert result back to uint
    //     uint result = fromDuint(res_duint);

    //     return result;
    // }

    // Accurately divides one 'duint' by another. Returns a 'duint'
    function decDiv(uint x, uint y) internal view returns (uint quotient) {
        uint prod_x_1E18 = SafeMath.mul(x, _1E18);
        uint half_y = SafeMath.div(y, 2);

        quotient = SafeMath.div(SafeMath.add( prod_x_1E18, half_y), y);
        return quotient;
    }

    // basic, no correction for floor div
    // function decDiv(uint x, uint y) internal view returns (uint quotient) {
    //     return SafeMath.div(SafeMath.mul(x, _1E18), y);
    // }

     // Accurately multiplies two 'duints'. Returns a 'duint'
    function decMul(uint x, uint y) internal view returns (uint prod) {
        uint prod_xy = SafeMath.mul(x, y);
        prod = SafeMath.div(SafeMath.add(prod_xy, _5E17), _1E18 );

        return prod;
    }

    // basic, no correction 
    //  function decMul(uint x, uint y) internal view returns (uint prod) {
    //     return SafeMath.div(SafeMath.mul(x, y), _1E18);
    // }

    // Accurately divides one uint by another. Returns a 'duint'
    function div_toDuint(uint x, uint y) internal view returns (uint quotient) {
        uint x_duint = toDuint(x);
        uint y_duint = toDuint(y);

        quotient = decDiv(x_duint, y_duint);
        return quotient;
    }

    // Accurately multiply one uint by a 'duint'. Returns a uint.
    function mul_uintByDuint( uint x, uint y_duint) internal view returns (uint prod) {
        uint x_duint = toDuint(x);

        uint prod_duint = decMul(x_duint, y_duint);
        uint prod = fromDuint(prod_duint);

        return prod;
    }

    // function mul_uintByDuint_roundUp( uint x, uint y_duint) internal view returns (uint prod) {
    //     uint x_duint = toDuint(x);

    //     uint prod_duint = decMul(x_duint, y_duint);
    //     uint prod = fromDuint_roundUp(prod_duint);

    //     return prod;
    // }

     // --- Helpers. Convert to and from duints ---

    function toDuint(uint integer) internal view returns(uint) {
        return SafeMath.mul(integer, _1E18);
    }

    function fromDuint(uint duint) internal view returns(uint) {
        // rounding: always round down
        return SafeMath.div(duint, _1E18);
    }

     function fromDuint_roundUp(uint duint) internal view returns(uint) {
        // rounding: common rounding.
        uint integer;
        integer =  SafeMath.div(duint, _1E18) + 1;  // round up
        return integer;
    }

    function fromDuint_commonRounding(uint duint) internal view returns(uint) {
        // rounding: common rounding. If first mantissa digit >=5 round up, else round down.
        uint integer;
        uint firstDecimalDigit = SafeMath.div(duint % _1E18, _1E17); // grab 18th digit from-right
        
        if (firstDecimalDigit >= 5 ){
            integer =  SafeMath.div(duint, _1E18) + 1;  // round up
            return integer;
        } else if (firstDecimalDigit < 5 ) {
            integer =  SafeMath.div(duint, _1E18); // round down
            return integer;
        }
    }

     // --- Normal Solidity multiplication and floor division ---
    // function normalDiv(uint a, uint b) public view returns(uint) {
    //     return SafeMath.div(a, b);
    // }

    // function normalMul(uint a, uint b) public view returns(uint) {
    //     return SafeMath.mul(a, b);
    // }  

    // --- Normal min function ---
    function getMin(uint a, uint b) internal view returns(uint) {
        if (a <= b) return a;
        else return b;
    }
}