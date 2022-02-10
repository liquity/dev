// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./BAMM.sol";
import "./../Dependencies/SafeMath.sol";


contract BLens {
    function add(uint256 x, uint256 y) public pure returns (uint256 z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }
    function sub(uint256 x, uint256 y) public pure returns (uint256 z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }
    function mul(uint256 x, uint256 y) public pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }
    function divup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = add(x, sub(y, 1)) / y;
    }
    uint256 constant WAD  = 10 ** 18;
    function wmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, y) / WAD;
    }
    function wdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, WAD) / y;
    }
    function wdivup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(mul(x, WAD), y);
    }
    uint256 constant RAY  = 10 ** 27;
    function rmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, y) / RAY;
    }
    function rmulup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(mul(x, y), RAY);
    }
    function rdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = mul(x, RAY) / y;
    }

    function getUnclaimedLqty(address user, BAMM bamm, ERC20 token) external returns(uint) {
        // trigger bamm (p)lqty claim
        bamm.withdraw(0);

        if(bamm.total() == 0) return 0;

        // duplicate harvest logic
        uint crop = sub(token.balanceOf(address(bamm)), bamm.stock());
        uint share = add(bamm.share(), rdiv(crop, bamm.total()));

        uint last = bamm.crops(user);
        uint curr = rmul(bamm.stake(user), share);
        if(curr > last) return curr - last;
        return 0;
    }
}
