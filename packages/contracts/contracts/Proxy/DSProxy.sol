
// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC

pragma solidity 0.6.11;

import './DSProxyCache.sol';

// Provides a flexible and updatable auth pattern which is completely
// separate from application logic. Fine-grained function access can be 
// controlled by specifying an authority, a contract which implements 
// the DSAuthority interface to define custom access permissions
interface DSAuthority {
    function canCall(
        address src, address dst, bytes4 sig
    ) external view returns (bool);
}

// Allows code execution using a persistant identity.
// This can be very useful to execute a sequence of atomic actions. 
// Since the owner of the proxy can be changed, this allows for 
// dynamic ownership models e.g. a multisig
contract DSProxy  {
    
    DSProxyCache public cache; // global cache for contracts
    DSAuthority  public  authority;  
    address      public  owner; 

    event LogSetAuthority (address indexed authority);
    event LogSetOwner     (address indexed owner);

    // Provides generic function call logging 
    // the indexed fields being queryable by blockchain clients
    event LogNote(
        bytes4   indexed  sig, // msg.sig
        address  indexed  guy, // msg.sender
        bytes32  indexed  foo, // the first function parameter 
        bytes32  indexed  bar, // the second function parameter
        uint256           wad, // msg.value
        bytes             fax // msg.data
    ) anonymous;

    modifier note {
        bytes32 foo;
        bytes32 bar;
        uint256 wad;
        assembly {
            foo := calldataload(4)
            bar := calldataload(36)
            wad := callvalue()
        }
        _;
        emit LogNote(msg.sig, msg.sender, foo, bar, wad, msg.data);
    }

    // By default, the auth modifier will restrict function-call access to 
    // the including contract owner and the including contract itself.
    modifier auth {
        require(_isAuthorized(msg.sender, msg.sig), "ds-auth-unauthorized");
        _;
    }

    function setOwner(address owner_)
        public
        auth
    {
        owner = owner_;
        emit LogSetOwner(owner);
    }

    function setAuthority(DSAuthority authority_)
        public
        auth
    {
        authority = authority_;
        emit LogSetAuthority(address(authority));
    }
    
    receive() external payable {
        // do nothing
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
        note
        payable
        returns (bytes memory response)
    {
        require(_target != address(0), "ds-proxy-target-address-required");

        // call contract in current context
        assembly {
            // let succeeded := delegatecall(sub(gas, 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
            let one := sub(gas, 5000) // compile error here
            let three := add(_data, 0x20)
            let four := mload(_data)
            let succeeded := delegatecall(one, _target, three, four, 0, 0)
            
            let size := returndatasize

            response := mload(0x40)
            mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(response, size)
            returndatacopy(add(response, 0x20), 0, size)

            switch iszero(succeeded)
            case 1 {
                // throw if delegatecall failed
                revert(add(response, 0x20), size)
            }
        }
    }

    //set new cache
    function setCache(address _cacheAddr)
        public
        auth
        note
        returns (bool)
    {
        require(_cacheAddr != address(0), "ds-proxy-cache-address-required");
        cache = DSProxyCache(_cacheAddr);  // overwrite cache
        return true;
    }

    function _isAuthorized(address src, bytes4 sig) internal view returns (bool) {
        if (src == address(this)) {
            return true;
        } else if (src == owner) {
            return true;
        } else if (authority == DSAuthority(0)) {
            return false;
        } else {
            return authority.canCall(src, address(this), sig);
        }
    }
}
