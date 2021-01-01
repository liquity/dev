// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-guard/blob/master/src/guard.sol

pragma solidity 0.6.11;

import './DSAuth.sol';

/**
 * Manages an Access Control List which maps source and destination addresses
 * to function signatures. Intended to be used as an authority for ds-auth 
 * where it acts as a lookup table for the canCall function to provide boolean
 * answers as to whether a particular address is authorized to call agiven 
 * function at another address.
 *
 * The acl is a mapping of [src][dst][sig] => boolean where an address src can
 * be either permitted or forbidden access to a function sig at address dst 
 * according to the boolean value. When used as an authority by DSAuth the 
 * src is considered to be the msg.sender, the dst is the including contract
 * and sig is the function which invoked the auth modifier.
*/

contract DSGuard is DSAuth, DSAuthority {
    
    bytes32 constant public ANY = bytes32(uint(-1));

    mapping (bytes32 => mapping (bytes32 => mapping (bytes32 => bool))) acl;

    event LogPermit(
        bytes32 indexed src,
        bytes32 indexed dst,
        bytes32 indexed sig
    );
    event LogForbid(
        bytes32 indexed src,
        bytes32 indexed dst,
        bytes32 indexed sig
    );

    function canCall(
        address src_, address dst_, bytes4 sig
    ) public override view returns (bool) {
        bytes32 src = bytes32(bytes20(src_));
        bytes32 dst = bytes32(bytes20(dst_));

        return acl[src][dst][sig]
            || acl[src][dst][ANY]
            || acl[src][ANY][sig]
            || acl[src][ANY][ANY]
            || acl[ANY][dst][sig]
            || acl[ANY][dst][ANY]
            || acl[ANY][ANY][sig]
            || acl[ANY][ANY][ANY];
    }

    function permit(bytes32 src, bytes32 dst, bytes32 sig) public auth {
        acl[src][dst][sig] = true;
        emit LogPermit(src, dst, sig);
    }

    function forbid(bytes32 src, bytes32 dst, bytes32 sig) public auth {
        acl[src][dst][sig] = false;
        emit LogForbid(src, dst, sig);
    }

    function permit(address src, address dst, bytes32 sig) public {
        permit(bytes32(bytes20(src)), bytes32(bytes20(dst)), sig);
    }
    function forbid(address src, address dst, bytes32 sig) public {
        forbid(bytes32(bytes20(src)), bytes32(bytes20(dst)), sig);
    }
}
