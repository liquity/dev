// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import './DSProxyFactory.sol';
import './DSProxy.sol';

// This Registry deploys new proxy instances through DSProxyFactory.build(address) and keeps a registry of owner => proxy
contract ProxyRegistry {
    mapping(address => DSProxy) public proxies;
    DSProxyFactory factory;

    constructor(address factory_) public {
        factory = DSProxyFactory(factory_);
    }

    // deploys a new proxy instance
    // sets owner of proxy to caller
    function build() public returns (address payable proxy) {
        proxy = build(msg.sender);
    }

    // deploys a new proxy instance
    // sets custom owner of proxy
    function build(address owner) public returns (address payable proxy) {
        // Not allow new proxy if the user already has one and remains being the owner
        require(proxies[owner] == DSProxy(0) || proxies[owner].owner() != owner); 
        
        proxy = factory.build(owner);
        proxies[owner] = DSProxy(proxy);
    }
}
