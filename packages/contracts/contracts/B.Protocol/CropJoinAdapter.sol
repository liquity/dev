// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./crop.sol";
import "./../StabilityPool.sol";

// NOTE! - this is not an ERC20 token. transfer is not supported.
contract CropJoinAdapter is CropJoin {
    string constant public name = "B.AMM LUSD-ETH";
    string constant public symbol = "LUSDETH";
    uint constant public decimals = 18;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    constructor(address _lqty) public 
    CropJoin(address(new Dummy()), "B.AMM", address(new DummyGem()), _lqty) {
    }

    function mint(address to, uint value) virtual internal {
        join(to, value);
        emit Transfer(address(0), to, value);
    }

    function burn(address owner, uint value) virtual internal {
        exit(owner, value);
        emit Transfer(owner, address(0), value);        
    }

    function totalSupply() public view returns (uint256) {
        return total;
    }

    function balanceOf(address owner) public view returns (uint256 balance) {
        balance = stake[owner];
    }

    // adapter to cropjoin
    function nav() public override returns (uint256) {
        return total;
    }
}

contract Dummy {
    fallback() external {}
}

contract DummyGem is Dummy {
    function transfer(address, uint) external pure returns(bool) {
        return true;
    }

    function transferFrom(address, address, uint) external pure returns(bool) {
        return true;
    }

    function decimals() external pure returns(uint) {
        return 18;
    } 
}