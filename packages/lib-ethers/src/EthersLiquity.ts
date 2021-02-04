import assert from "assert";

import { Signer } from "@ethersproject/abstract-signer";

import { _glue } from "@liquity/lib-base";

import { LiquityConnection, connectToLiquity } from "./contracts";

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

  /** @internal */
  static async _from(connection: LiquityConnection): Promise<EthersLiquity> {
    assert(Signer.isSigner(connection.signerOrProvider));

    const userAddress = await connection.signerOrProvider.getAddress();
    const readable = new ReadableEthersLiquity(connection, userAddress);
    const populatable = new PopulatableEthersLiquity(connection, readable);

    return new EthersLiquity(readable, populatable);
  }

  static connect(signer: Signer, network: string | number = "mainnet"): Promise<EthersLiquity> {
    return EthersLiquity._from(connectToLiquity(signer, network));
  }
}
