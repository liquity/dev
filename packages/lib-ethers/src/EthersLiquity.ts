import { Signer } from "@ethersproject/abstract-signer";

import { glue } from "@liquity/lib-base";

import { connectToContracts, LiquityContracts, LiquityDeployment } from "./contracts";
import {
  PopulatableEthersLiquity,
  SendableEthersLiquity,
  TransactableEthersLiquity
} from "./PopulatableEthersLiquity";
import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { ObservableEthersLiquity } from "./ObservableEthersLiquity";

export class EthersLiquity extends glue(
  TransactableEthersLiquity,
  ReadableEthersLiquity,
  ObservableEthersLiquity
) {
  readonly populate: PopulatableEthersLiquity;
  readonly send: SendableEthersLiquity;

  constructor(
    readable: ReadableEthersLiquity,
    observable: ObservableEthersLiquity,
    populatable: PopulatableEthersLiquity
  ) {
    const sendable = new SendableEthersLiquity(populatable);
    const transactable = new TransactableEthersLiquity(sendable);

    super(transactable, readable, observable);

    this.populate = populatable;
    this.send = sendable;
  }

  static from(contracts: LiquityContracts, signer: Signer, userAddress?: string) {
    const readable = new ReadableEthersLiquity(contracts, userAddress);
    const observable = new ObservableEthersLiquity(contracts, readable, userAddress);
    const populatable = new PopulatableEthersLiquity(contracts, readable, signer);

    return new EthersLiquity(readable, observable, populatable);
  }

  static async connect(deployment: LiquityDeployment, signer: Signer) {
    const { addresses, priceFeedIsTestnet } = deployment;
    const contracts = connectToContracts(addresses, priceFeedIsTestnet, signer);
    const userAddress = await signer.getAddress();

    return EthersLiquity.from(contracts, signer, userAddress);
  }
}
