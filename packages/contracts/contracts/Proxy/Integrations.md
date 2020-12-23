# 1. Introduction (Summary)

**Summary:** The `DssCdpManager` (aka `manager`) was created to enable a formalized process for CDPs to be transferred between owners. In short, the `manager` works by having a `dss` wrapper that allows users to interact with their CDPs in an easy way, treating them as non-fungible tokens (NFTs).

# 2. Contract Details

## Key Functionalities (as defined in the smart contract)

- `cdpAllow(uint cdp, address usr, uint ok)`: Allow/Disallow (`ok`) `usr` to manage `cdp`.
- `urnAllow(address usr, uint ok)`: Allow/Disallow (`ok`) `usr` to access `msg.sender` space (for sending a position in `quit`).
- `open(bytes32 ilk, address usr)`: Opens a new CDP for `usr` to be used for an `ilk` collateral type.
- `give(uint cdp, address dst)`: Transfers `cdp` to `dst`.
- `frob(uint cdp, int dink, int dart)`: Increments/decrements the `dink` amount of collateral locked and increments/decrements the `dart` amount of debt in the `cdp` depositing the generated DAI or collateral freed in the `cdp` address.
- `flux(bytes32 ilk, uint cdp, address dst, uint wad)`: Moves `wad` (precision 18) amount of collateral `ilk` from `cdp` to `dst`.
- `flux(uint cdp, address dst, uint wad)`: Moves `wad` amount of `cdp` collateral from `cdp` to `dst`.
- `move(uint cdp, address dst, uint rad)`: Moves `rad` (precision 45) amount of DAI from `cdp` to `dst`.
- `quit(uint cdp, address dst)`: Moves the collateral locked and debt generated from `cdp` to `dst`.
- `enter(address src, uint cdp)`: Moves the collateral locked and debt generated from `src` to `cdp`.
- `shift(uint cdpSrc, uint cdpDst)`: Moves the collateral locked and debt generated from `cdpSrc` to `cdpDst`.

**Note:** `dst` refers to the destination address. 

## Storage Layout

- `vat` : core contract address that holds the CDPs.
- `cdpi`: Auto incremental id.
- `urns`: Mapping `CDPId => UrnHandler`
- `list`: Mapping `CDPId => Prev & Next CDPIds` (double linked list)
- `owns`: Mapping `CDPId => Owner`
- `ilks`: Mapping `CDPId => Ilk` (collateral type)
- `first` : Mapping `Owner => First CDPId`
- `last`: Mapping `Owner => Last CDPId`
- `count`: Mapping `Owner => Amount of CDPs`
- `cdpCan`: Mapping `Owner => CDPId => Allowed Addr => True/False`
- `urnCan`: Mapping `Urn => Allowed Addr => True/False`

# 3. Key Mechanisms & Concepts

## Summary

The CDP manager was created as a way to enable CDPs to be treated more like assets that can be exchanged as non-fungible tokens (NFT) would. Originally when created, the [dss](https://github.com/makerdao/dss/tree/master/src) core contracts did not have the functionality to enable the transfer of CDP positions, hence the CDP manager was created to wrap this functionality and enable transferring between users. Since then, the core contracts have also implemented a native transfer functionality called `fork` which allows the transferring of a CDP to another address. However, there is a restriction, which is that the address owner that will be receiving the CDP needs to provide authorization that they do in fact want to receive it. This was created for the situation when a user is transferring the collateral that is locked as well as the debt generated. If you are simply moving collateral to another address, there is no issue but in the case that you are also transferring the debt generated, there is a chance of putting a perfectly safe CDP in a risky position. This makes the contract functionality a little more restrictive. Therefore, the CDP manager is a good option to keep a simple way of transferring CDPs and recognizing them via a numeric Id.

## High-level Purpose

- The `manager` receives the `vat` address in its creation and acts as an interface contract between it and the users.
- The `manager` keeps an internal registry of `id => owner` and `id => urn` allowing for the `owner` to execute `vat` functions for their `urn` via the `manager`.
- The `manager` keeps a double linked list structure that allows the retrieval of all the CDPs that an `owner` has via on-chain calls.
    - In short, this is what the `GetCdps` is for. This contract is a helper contract that allows the fetching of all the CDPs in just one call.

## CDP **Manager Usage Example (common path):**

- A User executes `open` and gets a `CDPId` in return.
- After this, the `CDPId` gets associated with an `urn` with `manager.urns(cdpId)` and then `join`'s collateral to it.
- After the user executes `frob`, the generated DAI will remain in the CDP's `urn`. Then the user can `move` it at a later point in time.
    - Note that this is the same process for collateral that is freed after `frob`. The user can `flux` it to another address at a later time.
- In the case where a user wants to abandon the `manager`, they can use `quit` as a way to migrate their position of their CDP to another `dst` address.

# 4. Gotchas (Potential source of user error)

- For the developers who want to integrate with the `manager`, they will need to understand that the CDP actions are still in the `urn` environment. Regardless of this, the `manager` tries to abstract the `urn` usage by a `CDPId`. This means that developers will need to get the `urn` (`urn = manager.urns(cdpId)`) to allow the `join`ing of collateral to that CDP.
- As the `manager` assigns a specific `ilk` per `CDPId` and doesn't allow others to use it for theirs, there is a second `flux` function which expects an `ilk` parameter. This function has the simple purpose of taking out collateral that was wrongly sent to a CDP that can't handle it/is incompatible.
- **Frob Function:**
    - When you `frob` in the CDP manager, you generate new DAI in the `vat` via the CDP manager which is then deposited in the `urn` that the CDP manager manages.
    - You would need to manually use the `flux` or `move` functions to get the DAI or collateral out.

# 5. Failure Modes (Bounds on Operating Conditions & External Risk Factors)

## **Potential Issues around Chain Reorganization**

When `open` is executed, a new `urn` is created and a `cdpId` is assigned to it for a specific `owner`. If the user uses `join` to add collateral to the `urn` immediately after the transaction is mined, there is a chance that a reorganization of the chain occurs. This would result in the user losing the ownership of that `cdpId`/`urn` pair, therefore losing their collateral. However, this issue can only arise when avoiding the use of the proxy functions ([https://github.com/makerdao/dss-proxy-actions](https://github.com/makerdao/dss-proxy-actions)) via a profile proxy ([https://github.com/dapphub/ds-proxy](https://github.com/dapphub/ds-proxy)) as the user will `open` the `cdp` and `join` collateral in the same transaction.