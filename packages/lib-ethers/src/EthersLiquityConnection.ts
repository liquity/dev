import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";

import {
  _connectToContracts,
  _LiquityContractAddresses,
  _LiquityContracts,
  _LiquityDeploymentJSON
} from "./contracts";

import devOrNull from "../deployments/dev.json";
import goerli from "../deployments/goerli.json";
import kovan from "../deployments/kovan.json";
import rinkeby from "../deployments/rinkeby.json";
import ropsten from "../deployments/ropsten.json";

const dev: _LiquityDeploymentJSON | null = devOrNull;

const deployments: {
  [network: string]: _LiquityDeploymentJSON | undefined;
  [chainId: number]: _LiquityDeploymentJSON | undefined;
} = {
  goerli,
  kovan,
  rinkeby,
  ropsten,

  3: ropsten,
  4: rinkeby,
  5: goerli,
  42: kovan,

  ...(dev !== null ? { [17]: dev, dev } : {})
};

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

export interface EthersLiquityConnection extends EthersLiquityConnectionOptionalParams {
  readonly signerOrProvider: Signer | Provider;

  readonly addresses: Record<string, string>;
  readonly version: string;
  readonly deploymentDate: number;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersLiquityConnection extends EthersLiquityConnection {
  readonly addresses: _LiquityContractAddresses;
  readonly _contracts: _LiquityContracts;
}

const connectedDeploymentFrom = (
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: Signer | Provider,
  _contracts: _LiquityContracts,
  optionalParams?: EthersLiquityConnectionOptionalParams
): _InternalEthersLiquityConnection =>
  branded({
    ...deployment,
    signerOrProvider,
    _contracts,
    ...optionalParams
  });

/** @internal */
export const _getContracts = (connection: EthersLiquityConnection): _LiquityContracts =>
  (connection as _InternalEthersLiquityConnection)._contracts;

const panic = <T>(e: unknown): T => {
  throw e;
};

/** @internal */
export const _requireSigner = (connection: EthersLiquityConnection): Signer =>
  Signer.isSigner(connection.signerOrProvider)
    ? connection.signerOrProvider
    : panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _requireProvider = (connection: EthersLiquityConnection): Provider =>
  Signer.isSigner(connection.signerOrProvider)
    ? connection.signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : connection.signerOrProvider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersLiquityConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _requireFrontendAddress = (connection: EthersLiquityConnection): string =>
  connection.frontendTag ?? panic(new Error("A frontend address is required"));

export const _usingStore = (
  connection: EthersLiquityConnection
): connection is EthersLiquityConnection & { useStore: EthersLiquityStoreOption } =>
  connection.useStore !== undefined;

export class UnsupportedNetworkError extends Error {
  readonly unsupportedNetwork: string | number;

  /** @internal */
  constructor(unsupportedNetwork: string | number) {
    super(`Unsupported network ${unsupportedNetwork}`);
    this.name = "UnsupportedNetworkError";
    this.unsupportedNetwork = unsupportedNetwork;
  }
}

/** @internal */
export const _connectToDeployment = (
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: Signer | Provider,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection =>
  connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment),
    optionalParams
  );

export type EthersLiquityStoreOption = "blockPolled";

export interface EthersLiquityConnectionOptionalParams {
  readonly userAddress?: string;
  readonly frontendTag?: string;
  readonly network?: string | number;
  readonly useStore?: EthersLiquityStoreOption;
}

/** @internal */
export function _connectToLiquity<T>(
  signerOrProvider: Signer | Provider,
  optionalParams: EthersLiquityConnectionOptionalParams & { useStore: T }
): EthersLiquityConnection & { useStore: T };

/** @internal */
export function _connectToLiquity(
  signerOrProvider: Signer | Provider,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection;

/** @internal */
export function _connectToLiquity(
  signerOrProvider: Signer | Provider,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection {
  const { network, ...restOfParams } = optionalParams ?? {};

  const optionalParamsWithDefaults = {
    network: network ?? "mainnet",
    ...restOfParams
  };

  const deployment: _LiquityDeploymentJSON =
    deployments[optionalParamsWithDefaults.network] ??
    panic(new UnsupportedNetworkError(optionalParamsWithDefaults.network));

  return connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment),
    optionalParamsWithDefaults
  );
}

/** @internal */
export const _connectWithProvider = (
  provider: Provider,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection => _connectToLiquity(provider, optionalParams);

/** @internal */
export const _connectWithSigner = async (
  signer: Signer,
  optionalParams?: EthersLiquityConnectionOptionalParams
): Promise<EthersLiquityConnection> => {
  if (optionalParams?.userAddress !== undefined) {
    throw new Error("Can't override userAddress when connecting through Signer");
  }

  return _connectToLiquity(signer, {
    ...optionalParams,
    userAddress: await signer.getAddress()
  });
};
