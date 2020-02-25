pragma solidity ^0.5.11;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@nomiclabs/buidler/console.sol";

contract NameRegistry is Ownable {

    mapping (string => address) public registry;

    event NewContractRegistered(string _name, address _addr);
    event ContractAddressUpdated(string _name, address _addr);

    function registerContract(string memory name, address addr) public onlyOwner returns(bool) {
        require(registry[name] == address(0), "NameReg: name already maps to an addr");
        registry[name] = addr;
        emit NewContractRegistered(name, addr);
        return true;
    }

    function updateAddress(string memory name, address addr) public onlyOwner returns(bool) {
        require(registry[name] != address(0), "NameReg: name does not map to an addr");
        registry[name] = addr;
        emit ContractAddressUpdated(name, addr);
        return true;
    }

    function getAddress(string memory name) public view returns(address) {
        require(registry[name] != address(0), "NameReg: name does not map to an addr");
        return registry[name];
    }
}