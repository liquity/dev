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
  _contracts: _LiquityContracts
): _LiquityConnection =>
  branded({
    ...deployment,
    signerOrProvider,
    _contracts
  });

/** @internal */
export const _getContracts = (connection: LiquityConnection): _LiquityContracts =>
  (connection as _LiquityConnection)._contracts;

/** @internal */
export const _getSigner = (connection: LiquityConnection): Signer => {
  if (!Signer.isSigner(connection.signerOrProvider)) {
    throw new Error("Must be connected through a Signer");
  }

  return connection.signerOrProvider;
};

/** @internal */
export const _getProvider = (connection: LiquityConnection): Provider => {
  if (Signer.isSigner(connection.signerOrProvider)) {
    if (!connection.signerOrProvider.provider) {
      throw new Error("Signer must be connected to a Provider");
    }

    return connection.signerOrProvider.provider;
  } else {
    return connection.signerOrProvider;
  }
};

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
  signerOrProvider: Signer | Provider
): LiquityConnection =>
  connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment)
  );

export function connectToLiquity(
  signerOrProvider: Signer | Provider,
  network: string | number = "mainnet"
): LiquityConnection {
  if (!(network in deployments)) {
    throw new UnsupportedNetworkError(network);
  }

  const deployment = deployments[network];

  return connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment)
  );
}
