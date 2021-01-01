// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-auth/blob/master/src/auth.sol

pragma solidity 0.6.11;

// Provides a flexible and updatable auth pattern which is completely
// separate from application logic. Fine-grained function access can be 
// controlled by specifying an authority, a contract which implements 
// the DSAuthority interface to define custom access permissions

interface DSAuthority {
    function canCall(
        address src, address dst, bytes4 sig
    ) external view returns (bool);
}

contract DSAuth {
    DSAuthority  public  authority;
    address      public  owner;

    event LogSetAuthority (address indexed authority);
    event LogSetOwner     (address indexed owner);

    constructor() public {
        owner = msg.sender;
        emit LogSetOwner(msg.sender);
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

    // By default, the auth modifier will restrict function-call access to 
    // the including contract owner and the including contract itself.
    // The auth modifier provided by DSAuth triggers the internal isAuthorized function
    // to require that the msg.sender is authorized ie. the sender is either:
    // the contract owner, the contract itself, or has been granted permission via a specified authority.
    modifier auth {
        require(isAuthorized(msg.sender, msg.sig), "ds-auth-unauthorized");
        _;
    }

    function isAuthorized(address src, bytes4 sig) internal view returns (bool) {
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
