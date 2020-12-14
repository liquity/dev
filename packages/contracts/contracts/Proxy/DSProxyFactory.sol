// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './DSProxyCache.sol';

// This factory deploys new proxy instances through build()
// Deployed proxy addresses are logged

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
