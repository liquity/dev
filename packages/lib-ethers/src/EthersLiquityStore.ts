import { LiquityStore } from "@liquity/lib-base";

import { LiquityConnection } from "./connection";

export abstract class EthersLiquityStore<T = unknown> extends LiquityStore<T> {
  protected readonly _connection: LiquityConnection;

  constructor(connection: LiquityConnection) {
    super();
    this._connection = connection;
  }

  /** @internal */
  _isMonitoringUser(address: string): boolean {
    return this._connection.userAddress === address;
  }
}
