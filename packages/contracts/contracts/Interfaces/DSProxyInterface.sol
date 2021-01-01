// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

abstract contract DSProxyInterface {

    function execute(address _target, bytes memory _data) public virtual payable returns (bytes32);

    function setCache(address _cacheAddr) public virtual payable returns (bool);

    function owner() public virtual returns (address);
}
