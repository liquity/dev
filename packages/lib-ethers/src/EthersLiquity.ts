import { Signer } from "@ethersproject/abstract-signer";

import { _glue } from "@liquity/lib-base";

import { connectToContracts, LiquityContracts, LiquityDeployment } from "./contracts";
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

  static from(contracts: LiquityContracts, signer: Signer, userAddress?: string): EthersLiquity {
    const readable = new ReadableEthersLiquity(contracts, userAddress);
    const populatable = new PopulatableEthersLiquity(contracts, readable, signer);

    return new EthersLiquity(readable, populatable);
  }

  static async connect(deployment: LiquityDeployment, signer: Signer): Promise<EthersLiquity> {
    const { addresses, priceFeedIsTestnet } = deployment;
    const contracts = connectToContracts(addresses, priceFeedIsTestnet, signer);
    const userAddress = await signer.getAddress();

    return EthersLiquity.from(contracts, signer, userAddress);
  }
}
