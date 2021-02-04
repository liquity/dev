import { LiquityConnection } from "./contracts";

/** @internal */
export class _EthersLiquityBase {
  protected readonly _connection: LiquityConnection;
  private readonly _userAddress?: string;

  constructor(connection: LiquityConnection, userAddress?: string) {
    this._connection = connection;
    this._userAddress = userAddress;
  }

  protected _requireAddress(): string {
    if (!this._userAddress) {
      throw Error("An address is required");
    }

    return this._userAddress;
  }
}
