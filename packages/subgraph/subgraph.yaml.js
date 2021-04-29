const fs = require("fs");

const { addresses } = require("@liquity/lib-ethers/deployments/mainnet.json");
// const { addresses } = require("@liquity/lib-ethers/deployments/dev.json");

// https://etherscan.io/tx/0x0b612c6ffcef059a1cb9ceda83dee44a3d74e35d5018f1b8b486f3186cd7850e
const startBlock = 12178551;
// const startBlock = 0;

const yaml = (strings, ...keys) =>
  strings
    .flatMap((string, i) => [string, Array.isArray(keys[i]) ? keys[i].join("") : keys[i]])
    .join("")
    .substring(1); // Skip initial newline

const manifest = yaml`
specVersion: 0.0.2
description: Liquity is a decentralized borrowing protocol offering interest-free liquidity against collateral in Ether.
repository: https://github.com/liquity/dev/tree/main/packages/subgraph
schema:
  file: ./schema.graphql
dataSources:
  - name: TroveManager
    kind: ethereum/contract
    network: mainnet
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
        - PriceChange
        - Trove
        - TroveChange
        - Redemption
        - Liquidation
        - SystemState
      abis:
        - name: TroveManager
          file: ../lib-ethers/abi/TroveManager.json
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: PriceFeedAddressChanged(address)
          handler: handlePriceFeedAddressChanged
        - event: TroveUpdated(indexed address,uint256,uint256,uint256,uint8)
          handler: handleTroveUpdated
        - event: TroveLiquidated(indexed address,uint256,uint256,uint8)
          handler: handleTroveLiquidated
        - event: Liquidation(uint256,uint256,uint256,uint256)
          handler: handleLiquidation
        - event: Redemption(uint256,uint256,uint256,uint256)
          handler: handleRedemption
  - name: BorrowerOperations
    kind: ethereum/contract
    network: mainnet
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
        - PriceChange
        - Trove
        - TroveChange
        - SystemState
      abis:
        - name: BorrowerOperations
          file: ../lib-ethers/abi/BorrowerOperations.json
        - name: TroveManager
          file: ../lib-ethers/abi/TroveManager.json
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: TroveUpdated(indexed address,uint256,uint256,uint256,uint8)
          handler: handleTroveUpdated
  - name: StabilityPool
    kind: ethereum/contract
    network: mainnet
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
        - PriceChange
        - StabilityDeposit
        - StabilityDepositChange
        - SystemState
      abis:
        - name: StabilityPool
          file: ../lib-ethers/abi/StabilityPool.json
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: UserDepositChanged(indexed address,uint256)
          handler: handleUserDepositChanged
        - event: ETHGainWithdrawn(indexed address,uint256,uint256)
          handler: handleETHGainWithdrawn
  - name: CollSurplusPool
    kind: ethereum/contract
    network: mainnet
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
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: CollBalanceUpdated(indexed address,uint256)
          handler: handleCollSurplusBalanceUpdated
  - name: LQTYStaking
    kind: ethereum/contract
    network: mainnet
    source:
      abi: LQTYStaking
      address: "${addresses.lqtyStaking}"
      startBlock: ${startBlock}
    mapping:
      file: ./src/mappings/LqtyStake.ts
      language: wasm/assemblyscript
      kind: ethereum/events
      apiVersion: 0.0.4
      entities:
        - Global
        - User
        - Transaction
        - LqtyStake
        - LqtyStakeChange
      abis:
        - name: LQTYStaking
          file: ../lib-ethers/abi/LQTYStaking.json
        - name: PriceFeed
          file: ../lib-ethers/abi/PriceFeed.json
      eventHandlers:
        - event: StakeChanged(indexed address,uint256)
          handler: handleStakeChanged
        - event: StakingGainsWithdrawn(indexed address,uint256,uint256)
          handler: handleStakeGainsWithdrawn
${[
  ["LUSDToken", addresses.lusdToken],
  ["LQTYToken", addresses.lqtyToken]
].map(
  ([name, address]) => yaml`
  - name: ${name}
    kind: ethereum/contract
    network: mainnet
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
