const fs = require("fs");

const network = process.argv[2] || "goerli";
const { addresses, startBlock } = require(`@stabilio/lib-ethers/deployments/${network}.json`);

console.log(`Preparing subgraph manifest for network "${network}"`);

const yaml = (strings, ...keys) =>
  strings
    .flatMap((string, i) => [string, Array.isArray(keys[i]) ? keys[i].join("") : keys[i]])
    .join("")
    .substring(1); // Skip initial newline

const manifest = yaml`
specVersion: 0.0.2
description: Stabilio is a decentralized borrowing protocol offering interest-free liquidity against collateral in Ether.
repository: https://github.com/stabiliofi/dev/tree/main/packages/subgraph
schema:
  file: ./schema.graphql
dataSources:
  - name: TroveManager
    kind: ethereum/contract
    network: goerli
    source:
      abi: TroveManager
      address: "${addresses.troveManager}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/TroveManager.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - Trove
        - TroveChange
        - Redemption
        - Liquidation
        - SystemState
      abis:
        - name: TroveManager
          file: ../lib-ethers/abi/TroveManager.json
      eventHandlers:
        - event: TroveUpdated(indexed address,uint256,uint256,uint256,uint8)
          handler: handleTroveUpdated
        - event: TroveLiquidated(indexed address,uint256,uint256,uint8)
          handler: handleTroveLiquidated
        - event: Liquidation(uint256,uint256,uint256,uint256)
          handler: handleLiquidation
        - event: Redemption(uint256,uint256,uint256,uint256)
          handler: handleRedemption
        - event: LTermsUpdated(uint256,uint256)
          handler: handleLTermsUpdated
  - name: BorrowerOperations
    kind: ethereum/contract
    network: goerli
    source:
      abi: BorrowerOperations
      address: "${addresses.borrowerOperations}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/BorrowerOperations.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - Trove
        - TroveChange
        - SystemState
      abis:
        - name: BorrowerOperations
          file: ../lib-ethers/abi/BorrowerOperations.json
      eventHandlers:
        - event: TroveUpdated(indexed address,uint256,uint256,uint256,uint8)
          handler: handleTroveUpdated
        - event: XBRLBorrowingFeePaid(indexed address,uint256)
          handler: handleXBRLBorrowingFeePaid
  - name: PriceFeed
    kind: ethereum/contract
    network: goerli
    source:
      abi: PriceFeed
      address: "${addresses.priceFeed}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/PriceFeed.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - Transaction
        - PriceChange
        - SystemState
      abis:
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: LastGoodPriceUpdated(uint256)
          handler: handleLastGoodPriceUpdated
  - name: StabilityPool
    kind: ethereum/contract
    network: goerli
    source:
      abi: StabilityPool
      address: "${addresses.stabilityPool}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/StabilityPool.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - StabilityDeposit
        - StabilityDepositChange
        - SystemState
        - Frontend
      abis:
        - name: StabilityPool
          file: ../lib-ethers/abi/StabilityPool.json
      eventHandlers:
        - event: UserDepositChanged(indexed address,uint256)
          handler: handleUserDepositChanged
        - event: ETHGainWithdrawn(indexed address,uint256,uint256)
          handler: handleETHGainWithdrawn
        - event: FrontEndRegistered(indexed address,uint256)
          handler: handleFrontendRegistered
        - event: FrontEndTagSet(indexed address,indexed address)
          handler: handleFrontendTagSet
  - name: CollSurplusPool
    kind: ethereum/contract
    network: goerli
    source:
      abi: CollSurplusPool
      address: "${addresses.collSurplusPool}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/CollSurplusPool.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - Trove
        - CollSurplusChange
        - SystemState
      abis:
        - name: CollSurplusPool
          file: ../lib-ethers/abi/CollSurplusPool.json
      eventHandlers:
        - event: CollBalanceUpdated(indexed address,uint256)
          handler: handleCollSurplusBalanceUpdated
  - name: STBLStaking
    kind: ethereum/contract
    network: goerli
    source:
      abi: STBLStaking
      address: "${addresses.stblStaking}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/StblStake.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - StblStake
        - StblStakeChange
      abis:
        - name: STBLStaking
          file: ../lib-ethers/abi/STBLStaking.json
      eventHandlers:
        - event: StakeChanged(indexed address,uint256)
          handler: handleStakeChanged
        - event: StakingGainsWithdrawn(indexed address,uint256,uint256)
          handler: handleStakeGainsWithdrawn
${[
  ["XBRLToken", addresses.xbrlToken],
  ["STBLToken", addresses.stblToken]
].map(
  ([name, address]) => yaml`
  - name: ${name}
    kind: ethereum/contract
    network: goerli
    source:
      abi: ERC20
      address: "${address}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/Token.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - Token
      abis:
        - name: ERC20
          file: ./abi/ERC20.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTokenTransfer
        - event: Approval(indexed address,indexed address,uint256)
          handler: handleTokenApproval
`
)}`;

fs.writeFileSync("subgraph.yaml", manifest);
