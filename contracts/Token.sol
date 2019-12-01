pragma solidity >0.5.0;
pragma solidity >0.5.0;


import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract CLVToken is ERC20 {
    address owner;
    address pool;
    bytes32 name;
    
    constructor(bytes32 _name) public {
        owner = msg.sender;
        name = _name;
    }    
    
    function registerPool(address _pool) public {
        require(msg.sender == owner, "Only the owner is authorized to register pool");
        pool = _pool;
    }
    
    function mint(address _account, uint256 _amount) public returns (bool) {
        require(msg.sender == pool, "Only the pool is authorized to mint CLV");
        _mint(_account, _amount);
        return true;
    }
    
    function burn(address _account, uint256 _amount) public returns (bool) {
        require(msg.sender == pool, "Only the pool is authorized to burn CLV");
        _burn(_account, _amount);
        return true;
    }
    
    function sendToPool(address _sender, uint256 _amount) public returns (bool) {
        require(msg.sender == pool, "Only the pool is authorized to deposit CLV");
        _transfer(_sender, pool, _amount);
        return true;
    }
    
    function returnFromPool(address _destination, uint256 _amount) public returns (bool) {
        require(msg.sender == pool, "Only the pool is authorized to return CLV");
        _transfer(pool, _destination, _amount);
        return true;
    }
    
}