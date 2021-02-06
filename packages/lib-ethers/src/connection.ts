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
  [network: string]: _LiquityDeploymentJSON;
  [chainId: number]: _LiquityDeploymentJSON;
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

export interface LiquityConnection {
  readonly signerOrProvider: Signer | Provider;
  readonly userAddress?: string;
  readonly frontendTag?: string;

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
export interface _LiquityConnection extends LiquityConnection {
  readonly addresses: _LiquityContractAddresses;
  readonly _contracts: _LiquityContracts;
}

const connectedDeploymentFrom = (
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: Signer | Provider,
  userAddress: string | undefined,
  frontendTag: string | undefined,
  _contracts: _LiquityContracts
): _LiquityConnection =>
  branded({
    ...deployment,
    signerOrProvider,
    userAddress,
    frontendTag,
    _contracts
  });

/** @internal */
export const _getContracts = (connection: LiquityConnection): _LiquityContracts =>
  (connection as _LiquityConnection)._contracts;

const panic = <T>(e: unknown): T => {
  throw e;
};

/** @internal */
export const _requireSigner = (connection: LiquityConnection): Signer =>
  Signer.isSigner(connection.signerOrProvider)
    ? connection.signerOrProvider
    : panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _requireProvider = (connection: LiquityConnection): Provider =>
  Signer.isSigner(connection.signerOrProvider)
    ? connection.signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : connection.signerOrProvider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: LiquityConnection,
  overrides?: { from?: string }
): string => overrides?.from ?? connection.userAddress ?? panic("A user address is required");

/** @internal */
export const _requireFrontendAddress = (connection: LiquityConnection): string =>
  connection.frontendTag ?? panic("A frontend address is required");

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
  userAddress?: string,
  frontendTag?: string
): LiquityConnection =>
  connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    userAddress,
    frontendTag,
    _connectToContracts(signerOrProvider, deployment)
  );

export interface LiquityConnectionOptionalParams {
  userAddress?: string;
  frontendTag?: string;
  network?: string | number;
}

export function connectToLiquity(
  signerOrProvider: Signer | Provider,
  optionalParams?: LiquityConnectionOptionalParams
): LiquityConnection {
  const network = optionalParams?.network ?? "mainnet";

  if (!(network in deployments)) {
    throw new UnsupportedNetworkError(network);
  }

  const deployment = deployments[network];

  return connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    optionalParams?.userAddress,
    optionalParams?.frontendTag,
    _connectToContracts(signerOrProvider, deployment)
  );
}
