pragma solidity >=0.5.0 <0.6.0;

import "../Dependencies/DappSys/proxy.sol";


// To avoid overloaded functions issue from tests
contract DSProxyWrapper is DSProxy {
    constructor(address _cacheAddr) public DSProxy(_cacheAddr) {}

    function executeTarget(address _target, bytes memory _data)
        public
        payable
        returns (bytes memory response)
    {
        return execute(_target, _data);
    }
}


contract DSProxyFactoryWrapper {
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
        proxy = address(new DSProxyWrapper(address(cache)));
        emit Created(msg.sender, owner, address(proxy), address(cache));
        DSProxy(proxy).setOwner(owner);
        isProxy[proxy] = true;
    }
}
