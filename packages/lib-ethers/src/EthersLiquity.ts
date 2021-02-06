import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";

import { _glue } from "@liquity/lib-base";

import { LiquityConnection, LiquityConnectionOptionalParams, connectToLiquity } from "./connection";

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
  static _from(connection: LiquityConnection): EthersLiquity {
    const readable = new ReadableEthersLiquity(connection);
    const populatable = new PopulatableEthersLiquity(connection, readable);

    return new EthersLiquity(readable, populatable);
  }

  static connect(
    signerOrProvider: Signer | Provider,
    optionalParams?: LiquityConnectionOptionalParams
  ): EthersLiquity {
    return EthersLiquity._from(connectToLiquity(signerOrProvider, optionalParams));
  }
}
