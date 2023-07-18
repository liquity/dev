import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@stabilio/lib-base";

import devOrNull from "../deployments/dev.json";
import sepolia from "../deployments/sepolia.json";
import goerli from "../deployments/goerli.json";

import { numberify, panic } from "./_utils";
import { EthersProvider, EthersSigner } from "./types";

import {
  _connectToContracts,
  _StabilioContractAddresses,
  _StabilioContracts,
  _StabilioDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";
const dev = devOrNull as _StabilioDeploymentJSON | null;

const deployments: {
  [chainId: number]: _StabilioDeploymentJSON | undefined;
} = {
  [sepolia.chainId]: sepolia,
  [goerli.chainId]: goerli,

  ...(dev !== null ? { [dev.chainId]: dev } : {})
};

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

/**
 * Information about a connection to the Stabilio protocol.
 *
 * @remarks
 * Provided for debugging / informational purposes.
 *
 * Exposed through {@link ReadableEthersStabilio.connection} and {@link EthersStabilio.connection}.
 *
 * @public
 */
export interface EthersStabilioConnection extends EthersStabilioConnectionOptionalParams {
  /** Ethers `Provider` used for connecting to the network. */
  readonly provider: EthersProvider;

  /** Ethers `Signer` used for sending transactions. */
  readonly signer?: EthersSigner;

  /** Chain ID of the connected network. */
  readonly chainId: number;

  /** Version of the Stabilio contracts (Git commit hash). */
  readonly version: string;

  /** Date when the Stabilio contracts were deployed. */
  readonly deploymentDate: Date;

  /** Number of block in which the first Stabilio contract was deployed. */
  readonly startBlock: number;

  /** Time period (in seconds) after `deploymentDate` during which redemptions are disabled. */
  readonly bootstrapPeriod: number;

  /** Total amount of STBL allocated for rewarding stability depositors. */
  readonly totalStabilityPoolSTBLReward: Decimal;

  /** Amount of STBL collectively rewarded to stakers of the liquidity mining pool per second. */
  readonly xbrlWethLiquidityMiningSTBLRewardRate: Decimal;
  
  /** Amount of STBL collectively rewarded to stakers of the liquidity mining pool per second. */
  readonly stblWethLiquidityMiningSTBLRewardRate: Decimal;

  /** A mapping of Stabilio contracts' names to their addresses. */
  readonly addresses: Record<string, string>;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersStabilioConnection extends EthersStabilioConnection {
  readonly addresses: _StabilioContractAddresses;
  readonly _contracts: _StabilioContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  _contracts: _StabilioContracts,
  _multicall: _Multicall | undefined,
  {
    deploymentDate,
    totalStabilityPoolSTBLReward,
    xbrlWethLiquidityMiningSTBLRewardRate,
    stblWethLiquidityMiningSTBLRewardRate,
    ...deployment
  }: _StabilioDeploymentJSON,
  optionalParams?: EthersStabilioConnectionOptionalParams
): _InternalEthersStabilioConnection => {
  if (
    optionalParams &&
    optionalParams.useStore !== undefined &&
    !validStoreOptions.includes(optionalParams.useStore)
  ) {
    throw new Error(`Invalid useStore value ${optionalParams.useStore}`);
  }

  return branded({
    provider,
    signer,
    _contracts,
    _multicall,
    deploymentDate: new Date(deploymentDate),
    totalStabilityPoolSTBLReward: Decimal.from(totalStabilityPoolSTBLReward),
    xbrlWethLiquidityMiningSTBLRewardRate: Decimal.from(xbrlWethLiquidityMiningSTBLRewardRate),
    stblWethLiquidityMiningSTBLRewardRate: Decimal.from(stblWethLiquidityMiningSTBLRewardRate),
    ...deployment,
    ...optionalParams
  });
};

/** @internal */
export const _getContracts = (connection: EthersStabilioConnection): _StabilioContracts =>
  (connection as _InternalEthersStabilioConnection)._contracts;

const getMulticall = (connection: EthersStabilioConnection): _Multicall | undefined =>
  (connection as _InternalEthersStabilioConnection)._multicall;

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: EthersStabilioConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

/** @internal */
export const _requireSigner = (connection: EthersStabilioConnection): EthersSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: EthersStabilioConnection): EthersProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersStabilioConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _requireFrontendAddress = (connection: EthersStabilioConnection): string =>
  connection.frontendTag ?? panic(new Error("A frontend address is required"));

/** @internal */
export const _usingStore = (
  connection: EthersStabilioConnection
): connection is EthersStabilioConnection & { useStore: EthersStabilioStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Stabilio is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableEthersStabilio.(connect:2)} and {@link EthersStabilio.(connect:2)}.
 *
 * @public
 */
export class UnsupportedNetworkError extends Error {
  /** Chain ID of the unsupported network. */
  readonly chainId: number;

  /** @internal */
  constructor(chainId: number) {
    super(`Unsupported network (chainId = ${chainId})`);
    this.name = "UnsupportedNetworkError";
    this.chainId = chainId;
  }
}

const getProviderAndSigner = (
  signerOrProvider: EthersSigner | EthersProvider
): [provider: EthersProvider, signer: EthersSigner | undefined] => {
  const provider: EthersProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  deployment: _StabilioDeploymentJSON,
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersStabilioConnectionOptionalParams
): EthersStabilioConnection =>
  connectionFrom(
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link EthersStabilioConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledStabilioStore} will be created.
 *
 * @public
 */
export type EthersStabilioStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableEthersStabilio.(connect:2)} and
 * {@link EthersStabilio.(connect:2)}.
 *
 * @public
 */
export interface EthersStabilioConnectionOptionalParams {
  /**
   * Address whose Trove, Stability Deposit, STBL Stake and balances will be read by default.
   *
   * @remarks
   * For example {@link EthersStabilio.getTrove | getTrove(address?)} will return the Trove owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link EthersSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Address that will receive STBL rewards from newly created Stability Deposits by default.
   *
   * @remarks
   * For example
   * {@link EthersStabilio.depositXBRLInStabilityPool | depositXBRLInStabilityPool(amount, frontendTag?)}
   * will tag newly made Stability Deposits with this address when its `frontendTag` parameter is
   * omitted.
   */
  readonly frontendTag?: string;

  /**
   * Create a {@link @stabilio/lib-base#StabilioStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link EthersStabilioStoreOption | options},
   * {@link ReadableEthersStabilio.(connect:2) | ReadableEthersStabilio.connect()} will return a
   * {@link ReadableEthersStabilioWithStore}, while
   * {@link EthersStabilio.(connect:2) | EthersStabilio.connect()} will return an
   * {@link EthersStabilioWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @stabilio/lib-base#StabilioStore.start | start()} function is called.
   */
  readonly useStore?: EthersStabilioStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams: EthersStabilioConnectionOptionalParams & { useStore: T }
): EthersStabilioConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersStabilioConnectionOptionalParams
): EthersStabilioConnection;

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersStabilioConnectionOptionalParams
): EthersStabilioConnection {
  const deployment: _StabilioDeploymentJSON =
    deployments[chainId] ?? panic(new UnsupportedNetworkError(chainId));

  return connectionFrom(
    provider,
    signer,
    _connectToContracts(signer ?? provider, deployment),
    _connectToMulticall(signer ?? provider, chainId),
    deployment,
    optionalParams
  );
}

/** @internal */
export const _connect = async (
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersStabilioConnectionOptionalParams
): Promise<EthersStabilioConnection> => {
  const [provider, signer] = getProviderAndSigner(signerOrProvider);

  if (signer) {
    if (optionalParams?.userAddress !== undefined) {
      throw new Error("Can't override userAddress when connecting through Signer");
    }

    optionalParams = {
      ...optionalParams,
      userAddress: await signer.getAddress()
    };
  }

  return _connectByChainId(provider, signer, (await provider.getNetwork()).chainId, optionalParams);
};
