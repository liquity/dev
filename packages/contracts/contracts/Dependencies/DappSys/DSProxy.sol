// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-proxy/blob/solc0.6/src/proxy.sol

pragma solidity 0.6.11;

import './DSProxyCache.sol';
import './DSAuth.sol';

// Allows code execution using a persistant identity.
// This can be very useful to execute a sequence of atomic actions. 
// Since the owner of the proxy can be changed, this allows for 
// dynamic ownership models e.g. a multisig

// Ownership of a DSProxy contract is set to an address when it is deployed. 
// There is support for authorities based on DSAuth if there is a need for 
// ownership of the DSProxy contract to be shared among multiple users.

contract DSProxy is DSAuth {
    
    DSProxyCache public cache; // global cache for contracts

    fallback() external payable { /* do nothing */ }
    
    function setCache(address _cacheAddr)
        public
        auth
        returns (bool)
    {
        require(_cacheAddr != address(0), "ds-proxy-cache-address-required");
        cache = DSProxyCache(_cacheAddr);  // overwrite cache
        return true;
    }
    
    constructor(address _cacheAddr) public {
        owner = msg.sender;
        setCache(_cacheAddr);
        emit LogSetOwner(msg.sender);
    }
    
    // use the proxy to execute calldata _data on contract _code
    function execute(bytes memory _code, bytes memory _data)
        public
        payable
        returns (address target, bytes memory response)
    {
        target = cache.read(_code);
        if (target == address(0)) {
            // deploy contract & store its address in cache
            target = cache.write(_code);
        }
        response = execute(target, _data);
    }
    
    function execute(address _target, bytes memory _data)
        public
        auth
        payable
        returns (bytes memory response)
    {   require(_target != address(0), "ds-proxy-target-address-required");
        // call contract in current context
        assembly {
            let succeeded := delegatecall(sub(gas(), 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
            let size := returndatasize()
            
            response := mload(0x40)
            mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(response, size)
            returndatacopy(add(response, 0x20), 0, size)
            
            switch iszero(succeeded)
            case 1 { // throw if delegatecall failed
                revert(add(response, 0x20), size)
            }
        }
    }
}
