# 1. Introduction (Summary)


# 2. Contract Details

## Key Functionalities (as defined in the smart contract)


# 3. Key Mechanisms & Concepts

## Summary


## High-level Purpose

Ownership and management - Troves and Stability Pool Deposits

Notarized third-party kernel extensions
OwNifty tokenize a Trove so you have a secondary market for collateralization,
Re-hypothecation 
Circuit of accumulation
Access to capital collateral the More liquid the better

Implementation Questions:
What needs to be provided by the script to the proxy contract
(One CDP one address)

Data
mapping (address => uint256) balances

Functions
constructor()
Concerns: 
* once a user tethers their proxy to one interface, they shouldn’t be able to use other interfaces simultaneously as that would likely cause interference (race conditions) between the interfaces
* The proxy contract should be updatable, since it is owned by the user. Should there be a timelock period?
* How do we pass the _hint parameters required by BorrowerOperations into the proxy calldata (should we process the hints in the frontend)
* Does it fall within the scope of the frontend to execute the function build in the DSProxyFactory contract to deploy a personal DSProxy contract for a user?
    * Since proxy addresses are derived from the internal nonce of the DSProxyFactory, it's recommended a 20 block confirmation time follows the build transaction, lest an accidental address reassignment during a block re-org.
Aims:

1. Determine what ownership and management functionality is needed by major DeFi aggregators, management services, and interfaces/front ends

2. Create a design document for the proxy solution, based on the feedback received

3. Implement proxy contracts and/or changes to core system, so that Liquity can integrate with these services

If possible let’s focus on simplicity, and keeping any overhaul of our core contracts to a minimum.

Research

* What existing management services would be great for Liquity users?  What functionality of Zerion, DeFi Saver etc could directly apply to, or be adapted for, our borrowers and depositors?

Currently Zerion’s public defi-sdk is quite limited:
https://www.youtube.com/watch?v=dp6CiNsM6pE

* Query user assets and debt deposited in DeFi protocols like Maker, Aave, dYdX, etc.
    * How much debt does 0xdead..beef have on Compound?
*  Get the underlying components of complex derivative ERC20 tokens
    * How much cUSDC vs ETH does ETHMACOAPY have?

Outreach

* Reach out to DeFi aggregators, front ends, and management services. Zerion, InstaDapp, Zapper, DeFiSaver, etc.  Robert & Ashleigh have some contacts already.

* How do they like to connect to the dApps they interact with, on users’ behalf?
* Do they need proxy contract(s) from us, or will they build their own?
* Can we just get away with a CDP ID and some ownership transfer functionality?
    * DSProxy mostly takes care of this
* Should the user transfer full ownership of their trove/deposit to the aggregator/management service? 
    * No
* Or should there be more fine-grained permissions?How come Stability pool gains are not used to immediately top up the trove


Research existing Proxy solutions

Alternative implementation found on Github
https://github.com/mcdexio/mai-protocol-v2/blob/2fcbf4b44f4595e5879ff5efea4e42c529ef0ce1/contracts/proxy/Proxy.sol


DefiSaver
today a minimum of $4000 worth of debt is needed for Automation to be enabled on any protocol (Maker, Compound, Aave) The reason for that is that transaction fees are also charged to Automation users (to the automation position actually,

This authority variable is set to something DefiSaver controls
https://github.com/liquity/dev/blob/proxy/packages/contracts/contracts/Proxy/DSProxy.sol#L27

DefiSaver has a “Monitor” contract that implements the DSAuthority interface for every Defi app that they support. This contract houses all the “scripts”, and accepts calls made by a few bots that each have a hardcoded ETH address…then there's a separate “MonitorProxy” contract, that the Monitor uses execute business logic on behalf of users by way of their DSproxies
eg Aave
Every Defi app also has a “Subscriptions” contract, which keeps track of all the DSproxies subscribed to DefiSaver for that app, with functions that let users set their subscription preferences (pre-set params relevant to the Defi app, e.g. target ICR)...I haven't found where those preferences are actually read in the course of business logic though
eg Aave
And finally there's a "SubscriptionsProxy" contract as well, where you give the MonitorProxy we mentioned above permission to call execute on your DSProxy (this givePermission thing is the only place where DSGuard is used)
eg Aave 

Does Alice first need to transfer trove ownership to her DSProxy?
it's a bit biased, but to avoid that I just open Alice's trove from her DSproxy in the first place so we don't have to think about ownership transfer

From there, she authorizes D to execute function calls to Liquity via DSProxy and D's script?
Alice's DSProxy authorizes D to execute function calls via MonitorProxy and D's Script
contracts/aave/automatic/AaveSubscriptionsProxy.sol:25
DecenterApps/defisaver-contracts | Added by GitHub
This canCall is really smart for helping manage the trove
contracts/aave/automatic/AaveMonitor.sol:130

Also, is it all-or-nothing permissions?
it has the capability of being function call-based, but since we are giving permission to call execute
https://github.com/DecenterApps/defisaver-contracts/blob/a51541b03c599ec28ea61d877b57cdd973d05cb1/contracts/auth/ProxyPermission.sol#L20
for all intents and purposes, I guess it would be all or nothing...but a simple way to still get granularity is having the Monitor split into several smart contracts, and letting user choose which ones to give permission to


DSProxy is the Profile Proxyhttps://docs.makerdao.com/dai.js/advanced-configuration/using-ds-proxyForwarding proxies:
Aimed at wrapping several functions into a composite function. Let’s see how much of that the aggregators would need.
 https://docs.makerdao.com/smart-contract-modules/proxy-module/proxy-actions-detailed-documentation

Above link is an example of a forwarding proxy (atomically wrapping functions in the dss-cdp-manager). Profile proxies are the “execution environment” for forwarding proxies...they take call data from functions in the forwarding proxy
To instantiate a profile proxy for a user, it is not possible to simply wrap that into a forwarding proxy call with some ETH attached because the profile proxy must have a DAI allowance attached to it  
Implementation Notes
- Create proxy contract(s) for trove and deposit
Proxy contracts can also directly own digital assets long term since the user always has full ownership of the contract and it can be treated as an extension of the user's own ethereum address.
The execute method implements the core functionality of DSProxy. It takes in two inputs, an address of the script-containing contract, and data which contains calldata to identify the script that needs to be executed along with it's input data. The execute() method runs the provided code in the context of the profile proxy.

Most of the functionality outlined below is implemented through such a “script” design pattern (msg.sender when the script is being executed will continue to be the user address instead of the address of the DSProxy contract)...

* Repay and Boosts (liquidation protection in case of collateral price drops, as well as automatic leverage increase in case of price increases...max gas price paid by users is 40 gwei, with anything over that covered by DefiSaver)
    * With flash loans, you could directly repay a part of your debt (by taking out a LUSD flash loan), take out an equivalent value of ETH and exchange it to LUSD to close the flash loan loop...as such it is possible to flash-lend funds to CDPs nearing liquidation 
        * allows for far greater adjustments in one transaction, removing the need for multiple transactions (thus less gas) 
    * openLoan’s generated LUSD can be used to immediately obtain additional ETH instead of being sent to your wallet
    * Automatically top up your stability deposit by selling a portion of the ETH gains 
* Multi-Sig Capability for
    * Credit delegation (a la Aave)? Array of pairs, [address<>allowance]  https://docs.aave.com/developers/developing-on-aave/the-protocol/credit-delegation
    * Automation never has access to funds within your actual wallet account and it makes all adjustments solely using the collateral within the CDP. 
        * You always remain the only owner and your account is the only one that can withdraw collateral or generate more Dai out of your CDP.
    * There is support for authorities based on DSAuth if there is a need for ownership of the DSProxy contract to be shared among multiple users.
        * http://dapp.tools/dappsys/
* Automation should be individually toggleable
    * Liquidate Troves on my behalf (configurable freq)
    * Replenish my Trove on my behalf (and thresholds)
    * Move my liquidation gains to my stability pool deposit
    * Redeposit my stability deposit gains into my stability deposit
