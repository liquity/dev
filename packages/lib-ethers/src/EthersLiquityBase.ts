import { LiquityContracts } from "./contracts";

/** @internal */
export class _EthersLiquityBase {
  protected readonly _contracts: LiquityContracts;
  private readonly _userAddress?: string;

  constructor(contracts: LiquityContracts, userAddress?: string) {
    this._contracts = contracts;
    this._userAddress = userAddress;
  }

  protected _requireAddress(): string {
    if (!this._userAddress) {
      throw Error("An address is required");
    }

    return this._userAddress;
  }
}
