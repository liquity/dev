import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";

import { Decimal } from "@stabilio/lib-base";

import {
  _StabilioContractAddresses,
  _StabilioContracts,
  _StabilioDeploymentJSON,
  _connectToContracts
} from "../src/contracts";

import { createUniswapV2Pair } from "./UniswapV2Factory";

type OmittedKeys = "xbrlWethUniToken" | "xbrlStblUniToken";

let silent = true;

export const log = (...args: unknown[]): void => {
  if (!silent) {
    console.log(...args);
  }
};

export const setSilent = (s: boolean): void => {
  silent = s;
};

const deployContractAndGetBlockNumber = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: unknown[]
): Promise<[address: string, blockNumber: number]> => {
  log(`Deploying ${contractName} ...`);
  const contract = await (await getContractFactory(contractName, deployer)).deploy(...args);

  log(`Waiting for transaction ${contract.deployTransaction.hash} ...`);
  const receipt = await contract.deployTransaction.wait();

  log({
    contractAddress: contract.address,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toNumber()
  });

  log();

  return [contract.address, receipt.blockNumber];
};

const deployContract: (
  ...p: Parameters<typeof deployContractAndGetBlockNumber>
) => Promise<string> = (...p) => deployContractAndGetBlockNumber(...p).then(([a]) => a);

const deployContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  priceFeedIsTestnet = true,
  overrides?: Overrides
): Promise<[addresses: Omit<_StabilioContractAddresses, OmittedKeys>, startBlock: number]> => {
  const [activePoolAddress, startBlock] = await deployContractAndGetBlockNumber(
    deployer,
    getContractFactory,
    "ActivePool",
    { ...overrides }
  );

  const addresses = {
    activePool: activePoolAddress,
    borrowerOperations: await deployContract(deployer, getContractFactory, "BorrowerOperations", {
      ...overrides
    }),
    troveManager: await deployContract(deployer, getContractFactory, "TroveManager", {
      ...overrides
    }),
    collSurplusPool: await deployContract(deployer, getContractFactory, "CollSurplusPool", {
      ...overrides
    }),
    communityIssuance: await deployContract(deployer, getContractFactory, "CommunityIssuance", {
      ...overrides
    }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
    lockupContractFactory: await deployContract(
      deployer,
      getContractFactory,
      "LockupContractFactory",
      { ...overrides }
    ),
    stblStaking: await deployContract(deployer, getContractFactory, "STBLStaking", { ...overrides }),
    priceFeed: await deployContract(
      deployer,
      getContractFactory,
      priceFeedIsTestnet ? "PriceFeedTestnet" : "PriceFeed",
      { ...overrides }
    ),
    sortedTroves: await deployContract(deployer, getContractFactory, "SortedTroves", {
      ...overrides
    }),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    }),
    gasPool: await deployContract(deployer, getContractFactory, "GasPool", {
      ...overrides
    }),
    xbrlWethUnipool: await deployContract(deployer, getContractFactory, "XBRLWETHUnipool", { ...overrides }),
    xbrlStblUnipool: await deployContract(deployer, getContractFactory, "XBRLSTBLUnipool", { ...overrides }),
  };

  return [
    {
      ...addresses,
      xbrlToken: await deployContract(
        deployer,
        getContractFactory,
        "XBRLToken",
        addresses.troveManager,
        addresses.stabilityPool,
        addresses.borrowerOperations,
        { ...overrides }
      ),

      stblToken: await deployContract(
        deployer,
        getContractFactory,
        "STBLToken",
        addresses.communityIssuance,
        addresses.stblStaking,
        addresses.lockupContractFactory,
        Wallet.createRandom().address, // _bountyAddress (TODO: parameterize this)
        addresses.xbrlWethUnipool, // xBRL : WETH _lpRewardsAddress
        addresses.xbrlStblUnipool, // XBRL : STBL _lpRewardsAddress
        Wallet.createRandom().address, // _momentZeroMultisigAddress (TODO: parameterize this)
        Wallet.createRandom().address, // _sixMonthsMultisigAddress (TODO: parameterize this)
        Wallet.createRandom().address, // _oneYearMultisigAddress (TODO: parameterize this)
        { ...overrides }
      ),

      multiTroveGetter: await deployContract(
        deployer,
        getContractFactory,
        "MultiTroveGetter",
        addresses.troveManager,
        addresses.sortedTroves,
        { ...overrides }
      )
    },

    startBlock
  ];
};

export const deployTellorCaller = (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  tellorAddress: string,
  queryID: string,
  overrides?: Overrides
): Promise<string> =>
  deployContract(deployer, getContractFactory, "TellorCaller", tellorAddress, queryID, { ...overrides });

const connectContracts = async (
  {
    activePool,
    borrowerOperations,
    troveManager,
    xbrlToken,
    collSurplusPool,
    communityIssuance,
    defaultPool,
    stblToken,
    hintHelpers,
    lockupContractFactory,
    stblStaking,
    priceFeed,
    sortedTroves,
    stabilityPool,
    gasPool,
    xbrlWethUnipool,
    xbrlStblUnipool,
    xbrlWethUniToken,
    xbrlStblUniToken
  }: _StabilioContracts,
  deployer: Signer,
  overrides?: Overrides
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  const txCount = await deployer.provider.getTransactionCount(deployer.getAddress());

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce =>
      sortedTroves.setParams(1e6, troveManager.address, borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      troveManager.setAddresses(
        borrowerOperations.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        gasPool.address,
        collSurplusPool.address,
        priceFeed.address,
        xbrlToken.address,
        sortedTroves.address,
        stblToken.address,
        stblStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      borrowerOperations.setAddresses(
        troveManager.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        gasPool.address,
        collSurplusPool.address,
        priceFeed.address,
        sortedTroves.address,
        xbrlToken.address,
        stblStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      stabilityPool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        activePool.address,
        xbrlToken.address,
        sortedTroves.address,
        priceFeed.address,
        communityIssuance.address,
        { ...overrides, nonce }
      ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        stabilityPool.address,
        defaultPool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      defaultPool.setAddresses(troveManager.address, activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      collSurplusPool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      hintHelpers.setAddresses(sortedTroves.address, troveManager.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      stblStaking.setAddresses(
        stblToken.address,
        xbrlToken.address,
        troveManager.address,
        borrowerOperations.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      lockupContractFactory.setSTBLTokenAddress(stblToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setAddresses(stblToken.address, stabilityPool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      xbrlWethUnipool.setParams(stblToken.address, xbrlWethUniToken.address, 2 * 30 * 24 * 60 * 60, {
        ...overrides,
        nonce
      }),

    nonce =>
      xbrlStblUnipool.setParams(stblToken.address, xbrlStblUniToken.address, 2 * 30 * 24 * 60 * 60, {
        ...overrides,
        nonce
      })
  ];

  const txs = await Promise.all(connections.map((connect, i) => connect(txCount + i)));

  let i = 0;
  await Promise.all(txs.map(tx => tx.wait().then(() => log(`Connected ${++i}`))));
};

const deployMockUniToken = (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
) =>
  deployContract(
    deployer,
    getContractFactory,
    "ERC20Mock",
    "Mock Uniswap V2",
    "UNI-V2",
    Wallet.createRandom().address, // initialAccount
    0, // initialBalance
    { ...overrides }
  );

export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  _priceFeedIsTestnet = true,
  _isDev = true,
  wethAddress?: string,
  overrides?: Overrides
): Promise<_StabilioDeploymentJSON> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  log("Deploying contracts...");
  log();

  const deployment: _StabilioDeploymentJSON = {
    chainId: await deployer.getChainId(),
    version: "unknown",
    deploymentDate: new Date().getTime(),
    bootstrapPeriod: 0,
    totalStabilityPoolSTBLReward: "0",
    xbrlWethLiquidityMiningSTBLRewardRate: "0",
    xbrlStblLiquidityMiningSTBLRewardRate: "0",
    _priceFeedIsTestnet,
    _uniTokenIsMock: !wethAddress,
    _isDev,

    ...(await deployContracts(deployer, getContractFactory, _priceFeedIsTestnet, overrides).then(
      async ([addresses, startBlock]) => ({
        startBlock,

        addresses: {
          ...addresses,

          xbrlWethUniToken: await (wethAddress
            ? createUniswapV2Pair(deployer, wethAddress, addresses.xbrlToken, overrides)
            : deployMockUniToken(deployer, getContractFactory, overrides)),
          xbrlStblUniToken: await (wethAddress
            ? createUniswapV2Pair(deployer, addresses.stblToken, addresses.xbrlToken, overrides)
            : deployMockUniToken(deployer, getContractFactory, overrides)),
        }
      })
    ))
  };

  const contracts = _connectToContracts(deployer, deployment);

  log("Connecting contracts...");
  await connectContracts(contracts, deployer, overrides);

  const stblTokenDeploymentTime = await contracts.stblToken.getDeploymentStartTime();
  const bootstrapPeriod = await contracts.troveManager.BOOTSTRAP_PERIOD();
  const totalStabilityPoolSTBLReward = await contracts.communityIssuance.STBLSupplyCap();
  const xbrlWethLiquidityMiningSTBLRewardRate = await contracts.xbrlWethUnipool.rewardRate();
  const xbrlStblLiquidityMiningSTBLRewardRate = await contracts.xbrlStblUnipool.rewardRate();

  return {
    ...deployment,
    deploymentDate: stblTokenDeploymentTime.toNumber() * 1000,
    bootstrapPeriod: bootstrapPeriod.toNumber(),
    totalStabilityPoolSTBLReward: `${Decimal.fromBigNumberString(
      totalStabilityPoolSTBLReward.toHexString()
    )}`,
    xbrlWethLiquidityMiningSTBLRewardRate: `${Decimal.fromBigNumberString(
      xbrlWethLiquidityMiningSTBLRewardRate.toHexString()
    )}`,
    xbrlStblLiquidityMiningSTBLRewardRate: `${Decimal.fromBigNumberString(
      xbrlStblLiquidityMiningSTBLRewardRate.toHexString()
    )}`
  };
};
