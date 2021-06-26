pragma solidity 0.6.11;

import "./crop.sol";

contract LPToken is CropJoin {
    string constant public name = "B.AMM LUSD-ETH";
    string constant public symbol = "LUSDETH";
    uint constant public decimals = 18;
    mapping(address => mapping(address => uint)) allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    constructor(address lqty) public 
    CropJoin(address(new Dummy()), "B.AMM", address(new DummyGem()), lqty) {}

    function mint(address to, uint value) internal {
        join(to, value);
        emit Transfer(address(0), to, value);
    }

    function burn(address owner, uint value) internal {
        exit(owner, value);
        emit Transfer(owner, address(0), value);        
    }

    function totalSupply() public view returns (uint256) {
        return total;
    }

    function balanceOf(address owner) public view returns (uint256 balance) {
        balance = stake[owner];
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        burn(msg.sender, value);
        mint(to, value);

        emit Transfer(msg.sender, to, value);
        success = true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        allowance[msg.sender][from] = sub(allowance[msg.sender][from], value);

        burn(from, value);
        mint(to, value);

        emit Transfer(from, to, value);
        success = true;
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
    }
}

contract Dummy {
    fallback() external payable {}
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