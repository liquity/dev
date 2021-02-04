import { ConnectedLiquityDeployment, _LiquityContracts, _getContracts } from "./contracts";

/** @internal */
export class _EthersLiquityBase {
  protected readonly _contracts: _LiquityContracts;
  private readonly _userAddress?: string;

  constructor(deployment: ConnectedLiquityDeployment, userAddress?: string) {
    this._contracts = _getContracts(deployment);
    this._userAddress = userAddress;
  }

  protected _requireAddress(): string {
    if (!this._userAddress) {
      throw Error("An address is required");
    }

    return this._userAddress;
  }
}
