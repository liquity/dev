import { LiquityContracts } from "./contracts";

export class EthersLiquityBase {
  protected readonly contracts: LiquityContracts;
  private readonly userAddress?: string;

  constructor(contracts: LiquityContracts, userAddress?: string) {
    this.contracts = contracts;
    this.userAddress = userAddress;
  }

  protected requireAddress(): string {
    if (!this.userAddress) {
      throw Error("An address is required");
    }

    return this.userAddress;
  }
}
