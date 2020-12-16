
# DSProxy

An enabling interface for smart wallets, designed for user's signature pre-approval of various scripts that bundle multiple contract calls within one transaction. This is something that vanilla EOAs cannot do, because they are limited to interacting with only one contract per tranaction. 

Scripts are implemented in Solidity as functions and multiple scripts are typically combined and deployed together as a single contract. A DSProxy contract can only execute one script in a single transaction.

This DSProxy contract can also directly own digital assets long term since the user always has full ownership of the contract and it can be treated as an extension of the user's own ethereum address.

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

# Integrations

DSProxy is already running in production in several Ethereum projects:

- Maker's Oasis
- DeFi Saver
- Balancer Exchange

Because the ProxyRegistry caches deployments, it follows that if you either already or will use one of the dApps above, you don't/won't have to re-deploy your DSProxy. #DeFiFTW
 
# Further Reading
- [Working with DSProxy](https://github.com/makerdao/developerguides/blob/master/devtools/working-with-dsproxy/working-with-dsproxy.md#working-with-dsproxy)
- [Why DeFi Saver loves DSProxy](https://medium.com/defi-saver/a-short-introduction-to-makers-dsproxy-and-why-we-l-it-c88932595be#:~:text=The%20other%20reason%20why%20we,the%20very%20same%20DSProxy%20contract.)