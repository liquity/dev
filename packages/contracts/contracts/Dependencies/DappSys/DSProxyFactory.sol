// SPDX-License-Identifier: GPL3
// Copyright (C) 2017  DappHub, LLC
// Adapted from https://github.com/dapphub/ds-proxy/blob/solc0.6/src/proxy.sol

pragma solidity 0.6.11;

import './DSProxyCache.sol';
import './DSProxy.sol';

// Factory Contract
// Deployed proxy addresses can be logged
// This factory deploys new proxy instances through build()

contract DSProxyFactory {
    
    event Created(address indexed sender, address indexed owner, address proxy, address cache);
    
    mapping(address => bool) public isProxy;
    
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
