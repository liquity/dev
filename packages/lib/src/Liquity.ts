import { Signer } from "ethers";
import { Provider } from "ethers/providers";

import { LiquityContractAddresses, LiquityContracts } from "./contracts";
import { connectToContracts, getContractsFromNameRegistry } from "./contractConnector";

export class Liquity {
  private readonly contracts: LiquityContracts;

  private constructor(contracts: LiquityContracts) {
    this.contracts = contracts;
  }

  public static connect(
    addresses: LiquityContractAddresses,
    signerOrProvider: Signer | Provider
  ) {
    return new Liquity(connectToContracts(addresses, signerOrProvider));
  }

  public static async connectUsingNameRegistry(
    nameRegistryAddress: string,
    signerOrProvider: Signer | Provider
  ) {
    return new Liquity(await getContractsFromNameRegistry(nameRegistryAddress, signerOrProvider));
  }
}
