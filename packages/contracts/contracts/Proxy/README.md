
# DSProxy
An enabling interface for smart wallets, designed for user's signature pre-approval of various scripts that bundle multiple calls to (potentially) multiple contracts within one transaction. This is something that vanilla EOAs cannot do, because they are limited to interacting with only one contract per tranaction. 

Scripts are implemented in Solidity as functions and multiple scripts are typically combined and deployed together as a single contract. A DSProxy can only execute one script in a single transaction, using the bytecode for the contract as well as the calldata for the script they want to execute.

### Execute
`execute(address target, bytes data)` function implements the core functionality of DSProxy. It takes in two inputs, an address of the contract containing scripts, and data which contains calldata to identify the script that needs to be executed along with it's input data.

`msg.sender` when the script is being executed will continue to be the user address instead of the address of the DSProxy contract.

`execute(bytes code, bytes data)` is an additional function that can be used when a user wants to deploy a contract containing scripts and then call one of the scripts in a single transaction. A cache registers the address of contract deployed to save gas by skipping deployment when other users call execute with the same bytecode later.

This DSProxy contract can also directly own ETH and tokens long term since the user always has full ownership of the contract and it can be treated as an extension of the user's own ethereum address.

There are two contracts to be aware of besides the DSProxy itself:

### ProxyRegistry (DSProxyFactory)
Integrations begins with the so-called "proxy registry" contract.

This is a factory contract meant to deploy an instance of DSProxy so that you don't have to compile it yourself.

You simply call the `build` function and a DSProxy controlling a Trove that belongs to `msg.sender` will be created for you.

Liquity AG (the organization that created the Liquity Protocol being proxied) has deployed its registry at address {{addr}}} on Ethereum Mainnet.

### ProxyScript (target contract with scripts)
Then, there's the target contract. This is where you have to write code, your custom business logic. The idea is that you import your contract interfaces and bundle multiple contract calls in one function. For example, this is how a script that makes a deposit in the Compound protocol would look like:

```
function deposit(address token, address cToken,
  uint256 amount) external {
	Erc20Interface(token).transferFrom(msg.sender,
		   address(this), amount
	);
	Erc20Interface(token).approve(cToken, uint256(-1));
	require(CTokenInterface(cToken).mint(amount) == 0);
}
```

You would compile your target contract, deploy it to Ethereum and call the execute function of the DSProxy `function execute(address _target, bytes memory _data)` to finally make the contract call. The `_target` argument is the address of the target contract, while `_data` is the the `calldata` used to identify what function to execute on the target.

# Production Usage
Deploying a script to production involves creating user interfaces that can handle a DSProxy contract deployment for users who need one, and then facilitating their interactions with various deployed scripts through their deployed DSProxy contracts.

A common Proxy Registry can be used by all projects to deploy DSProxy contracts for users. The address of the deployed DSProxy contract is stored in the registry and can be looked up in the future to avoid creating a new DSProxy contract for users who already have one.

# Integrations
DSProxy is already running in production in several Ethereum projects:

- Maker's Oasis
- DeFi Saver
- Balancer Exchange

Forwarding proxies are simple contracts that aggregate function calls in the body of a single method. These are used in the CDP Portal and Oasis Direct in order to allow users to execute multiple transactions atomically, which is both safer and more user-friendly than implementing several steps as discrete transactions.

Forwarding proxies are meant to be as simple as possible, so they lack some features that could be important if they are to be used as interfaces for more complex smart contract logic. This problem can be solved by using profile proxies (i.e. copies of DSProxy) to execute the functionality defined in the forwarding proxies.

The first time an account is used to interact with any Maker application, the user will be prompted to deploy a profile proxy. This copy of DSProxy can be used in any product, including dai.js, by way of a universal proxy registry. Then, the calldata from any function in the forwarding proxy can be passed to DSProxy's execute()method, which runs the provided code in the context of the profile proxy.

It's possible for users' token allowances to persist from one Maker application to another, and it allows users to recover any funds mistakenly sent to the proxy's address. Many of the functions in DSProxyService will only be relevant to power users. All that is strictly required to automatically generate a function's calldata and find the correct profile proxy is the inclusion of { dsProxy: true } in the options object for any transaction — provided the user has already deployed a profile proxy. If that's not certain, it may also be necessary to query the registry to determine if a user already owns a proxy, and to build one if they do not.

Because the ProxyRegistry caches deployments, it follows that if you either already or will use one of the dApps above, you don't/won't have to re-deploy your DSProxy. #DeFiFTW

### InstaDapp
Proprietary Maker proxy, about 10% of ETH currently collateralized in Maker has been locked using InstaDapp. InstaDapp proxy wallet disables the ability to call any functions for the CDPs they hold except those allowed by the InstaDapp team in their smart contracts

# Further Reading
- [Working with DSProxy](https://github.com/makerdao/developerguides/blob/master/devtools/working-with-dsproxy/working-with-dsproxy.md#working-with-dsproxy)
- [Why DeFi Saver loves DSProxy](https://medium.com/defi-saver/a-short-introduction-to-makers-dsproxy-and-why-we-l-it-c88932595be#:~:text=The%20other%20reason%20why%20we,the%20very%20same%20DSProxy%20contract.)
- [OpenZeppelin Proxy Design Pattern](https://blog.openzeppelin.com/proxy-patterns/)
- [Short overview of DeFi aggregators](https://medium.com/@Ashaegan/aggregators-a3df3bd32892)
- [Comparing MakerDAO management apps— Oasis, Zerion, DeFi Saver and InstaDapp](https://medium.com/defi-saver/comparing-makerdao-management-apps-oasis-zerion-defi-saver-and-instadapp-5d23cd108b6f)
- [DeFiPulse list of interfaces](https://defipulse.com/defi-list/)
  