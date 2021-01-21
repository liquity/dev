
# Summary

Third-party services will use a DSProxy instance to perform actions on the instance owner's behalf, and we've written some intermediate contracts ("scripts") that can be used with DSProxy to establish automation and achieve efficiency in reducing the number of individual transaction calls to perform common Liquity operation sequences.

For example, when a Liquity user's DSProxy receives ETH and LQTY as gains to be paid out, the owner of the proxy must subsequently delegatecall into a script (a function in LiquityScript.sol), via `execute` on their proxy.     Scripts never have access to ETH within the DSProxy and all operations are performed solely using balances assigned the DSProxy address by Liquity core.

# Key Mechanisms & Concepts

tldr: Alice's DSProxy authorizes Monitor via SubsciptionScript to `execute` function calls from LiquityScript via MonitorScript.

DSProxy has a single owner and inherits from DSAuth, which has a single "authority" variable by default (potentially, DSAuth could be leveraged for authority over the DSProxy contract to be shared among multiple authorities). This authority variable is set to the address of a so-called "Monitor" contract, which is called into by chain-monitoring bots owned by the contract's deployer. A simple way to achieve granular access control is having the Monitor split into several smart contracts, and letting user choose which ones to give permission to one by one.

In Liquity, the debt positions (troves), stakes and deposits are owned by the calling address, and are non-transferrable. There's no mandatory coupling between Troves/stakes/deposits - users could use a different address for each of these actions: open a trove, stake LQTY, make a LUSD deposit. In practice, though, DSProxy-enabled interactions will result in all said entities being owned by the DSProxy address.

A user whom created their Trove without using DSProxy and subsequently decides to use DSProxy must first close their Trove. There is no Trove ownership transfer functionality between EOAs and DSProxies. However, a script may be implemented which does the same (close and then immediately open a new Trove) for seamless Trover ownership transfer between DSProxies.

## Subscriptions

Once a user registers their Proxy to one frontend, their preferences and settings will not be saved to their Proxy. Users should subscribe individually to each frontend they wish to use. 

A `canCall` function in the Monitor contract determines if a MonitorScript contract is authorized to be `execute`d through a given user's DSProxy and the circumstantial conditions are appropriate for executing specified functions within a script contract. Users grant this authorization by executing `givePermission` in SubscriptionScript.sol via their DSProxies. 

# DSProxy
An enabling interface for smart wallets, designed for user's signature pre-approval of various scripts that bundle multiple calls to (potentially) multiple contracts within one transaction. This is something that vanilla EOAs cannot do, because they are limited to interacting with only one contract per tranaction. 

Scripts are implemented in Solidity as functions and multiple scripts are typically combined and deployed together as a single contract. A DSProxy can only execute one script in a single transaction, using the bytecode for the contract as well as the calldata for the script they want to execute.

### Execute
`execute(address target, bytes data)` function implements the core functionality of DSProxy. It takes in two inputs, an address of the contract containing scripts, and data which contains calldata to identify the script that needs to be executed along with it's input data. The execute() method runs the provided code in the context of the proxy.

`msg.sender` when the script is being executed will continue to be the user address instead of the address of the DSProxy contract.

`execute(bytes code, bytes data)` is an additional function that can be used when a user wants to deploy a contract containing scripts and then call one of the scripts in a single transaction. A cache registers the address of contract deployed to save gas by skipping deployment when other users call execute with the same bytecode later.

This DSProxy contract can also directly own ETH and tokens long term since the user always has full ownership of the contract and it can be treated as an extension of the user's own Ethereum address.

There are a few contracts to make use of in addition to the DSProxy itself:

### ProxyRegistry (DSProxyFactory)
Integrations begins with the so-called "proxy registry" contract.

The registry combines a mapping of EOA owner addresses to the DSProxies they own, with a factory contract meant to deploy an instance of DSProxy so that you don't have to compile it yourself.

It falls within the scope of the frontend to execute the `build` in the DSProxyFactory contract (via its own registry, though this is optional) to deploy a personal DSProxy contract for a user. 

Considering the high likelihood that a user already has a DSProxy under their ownership, the frontend must first query those registries to determine whether a user need to pay gas to deploy a DSProxy.

Since proxy addresses are derived from the internal nonce of the DSProxyFactory, it's recommended a 20 block confirmation time follows the build transaction, lest an accidental address reassignment during a block re-org.

### LiquityScript (target contract with scripts)
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

A common ProxyRegistry could potentially be used by several projects to deploy DSProxy contracts for users. The address of the deployed DSProxy contract is stored in the registry and can be looked up in the future to avoid creating a new DSProxy contract for users who already have one.

# Integrations
DSProxy is already running in production in several Ethereum projects:

- Maker's Oasis
- DeFi Saver
- Balancer Exchange

Forwarding proxies are simple contracts that aggregate function calls in the body of a single method. These are used in the CDP Portal and Oasis Direct in order to allow users to execute multiple transactions atomically, which is both safer and more user-friendly than implementing several steps as discrete transactions.

Forwarding proxies are meant to be as simple as possible, so they lack some features that could be important if they are to be used as interfaces for more complex smart contract logic. This problem can be solved by using profile proxies (i.e. copies of DSProxy) to execute the functionality defined in the forwarding proxies.

The first time an account is used to interact with any Maker application, the user will be prompted to deploy a profile proxy. This copy of DSProxy can be used in any product, including dai.js, by way of a universal proxy registry. Then, the calldata from any function in the forwarding proxy can be passed to DSProxy's execute()method, which runs the provided code in the context of the profile proxy.

It's possible for users' token allowances to persist from one Maker application to another, and it allows users to recover any funds mistakenly sent to the proxy's address. Many of the functions in DSProxyService will only be relevant to power users. All that is strictly required to automatically generate a function's calldata and find the correct profile proxy is the inclusion of `{ dsProxy: true }` in the options object for any transaction — provided the user has already deployed a profile proxy. If that's not certain, it may also be necessary to query the registry to determine if a user already owns a proxy, and to build one if they do not.

Because the ProxyRegistry caches deployments, it follows that if you either already or will use one of the dApps above, you don't/won't have to re-deploy your DSProxy. #DeFiFTW

### DefiSaver
Today a minimum of $4000 worth of debt is needed for Automation to be enabled on any protocol (Maker, Compound, Aave). The reason for that is that transaction fees are also charged to Automation users (to the automation position).

### InstaDapp
Has a proprietary Maker proxy, about 10% of ETH currently collateralized in Maker has been locked using InstaDapp. InstaDapp proxy wallet disables the ability to call any functions for the CDPs they hold except those allowed by the InstaDapp team in their smart contracts

# Further Reading
- [Working with DSProxy](https://github.com/makerdao/developerguides/blob/master/devtools/working-with-dsproxy/working-with-dsproxy.md#working-with-dsproxy)
- [Why DeFi Saver loves DSProxy](https://medium.com/defi-saver/a-short-introduction-to-makers-dsproxy-and-why-we-l-it-c88932595be#:~:text=The%20other%20reason%20why%20we,the%20very%20same%20DSProxy%20contract.)
- [OpenZeppelin Proxy Design Pattern](https://blog.openzeppelin.com/proxy-patterns/)
- [Short overview of DeFi aggregators](https://medium.com/@Ashaegan/aggregators-a3df3bd32892)
- [Comparing MakerDAO management apps— Oasis, Zerion, DeFi Saver and InstaDapp](https://medium.com/defi-saver/comparing-makerdao-management-apps-oasis-zerion-defi-saver-and-instadapp-5d23cd108b6f)
- [DeFiPulse list of interfaces](https://defipulse.com/defi-list/)
  