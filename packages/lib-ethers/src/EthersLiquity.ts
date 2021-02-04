import assert from "assert";

import { Signer } from "@ethersproject/abstract-signer";

import { _glue } from "@liquity/lib-base";

import {
  ConnectedLiquityDeployment,
  connectToLiquity,
  _connectToDeployment,
  _LiquityDeploymentJSON
} from "./contracts";

import {
  PopulatableEthersLiquity,
  SendableEthersLiquity,
  TransactableEthersLiquity
} from "./PopulatableEthersLiquity";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";

type GluedEthersLiquity = TransactableEthersLiquity & ReadableEthersLiquity;

const GluedEthersLiquity: new (
  transactable: TransactableEthersLiquity,
  readable: ReadableEthersLiquity
) => GluedEthersLiquity = _glue(TransactableEthersLiquity, ReadableEthersLiquity);

/**
 * Convenience class that combines multiple interfaces of the library in one object.
 *
 * @public
 */
export class EthersLiquity extends GluedEthersLiquity {
  readonly populate: PopulatableEthersLiquity;
  readonly send: SendableEthersLiquity;

  constructor(readable: ReadableEthersLiquity, populatable: PopulatableEthersLiquity) {
    const sendable = new SendableEthersLiquity(populatable);
    const transactable = new TransactableEthersLiquity(sendable);

    super(transactable, readable);

    this.populate = populatable;
    this.send = sendable;
  }

  private static async _from(deployment: ConnectedLiquityDeployment): Promise<EthersLiquity> {
    assert(Signer.isSigner(deployment.signerOrProvider));

    const userAddress = await deployment.signerOrProvider.getAddress();
    const readable = new ReadableEthersLiquity(deployment, userAddress);
    const populatable = new PopulatableEthersLiquity(deployment, readable);

    return new EthersLiquity(readable, populatable);
  }

  static connect(signer: Signer, network: string | number = "mainnet"): Promise<EthersLiquity> {
    return EthersLiquity._from(connectToLiquity(signer, network));
  }

  /** @internal */
  static _connectToDeployment(
    deployment: _LiquityDeploymentJSON,
    signer: Signer
  ): Promise<EthersLiquity> {
    return EthersLiquity._from(_connectToDeployment(deployment, signer));
  }
}
