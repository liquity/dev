// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-proxy/blob/solc0.6/src/proxy.sol

pragma solidity 0.6.11;

import './DSProxyCache.sol';
import './DSProxy.sol';

// Factory Contract
// Deployed proxy addresses can be logged
// This factory deploys new proxy instances through build()

/** 
 * The function build in the DSProxyFactory contract is used to 
 * deploy a personal DSProxy contract. Since proxy addresses are
 * derived from the internal nonce of the DSProxyFactory, it's 
 * reccommended a 20 block confirmation time follows the build 
 * transaction, lest an accidental address re-assignment during
 * a block re-org. For production use cases on mainnet you can 
 * use a common factory contract that is already being used by
 * existing projects to avoid deploying redundant DSProxy 
 * contracts for users who already have one.
*/

contract DSProxyFactory {
    
    event Created(address indexed sender, address indexed owner, address proxy, address cache);
    
    mapping(address=>bool) public isProxy;
    
    DSProxyCache public cache;

    constructor() public {
        cache = new DSProxyCache();
    }

    // deploys a new proxy instance
    // sets owner of proxy to caller
    function build() public returns (address payable proxy) {
        proxy = build(msg.sender);
    }

    // deploys a new proxy instance
    // sets custom owner of proxy
    function build(address owner) public returns (address payable proxy) {
        proxy = address(new DSProxy(address(cache)));
        DSProxy(proxy).setOwner(owner);
        isProxy[proxy] = true;
        
        emit Created(msg.sender, owner, address(proxy), address(cache));
    }
}
