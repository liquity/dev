import { Web3Provider } from "ethers/providers";
import { bigNumberify, BigNumber } from "ethers/utils";

import { Decimal, Decimalish } from "../utils/Decimal";
import { LiquityContractAddresses, LiquityContracts } from "./contracts";
import { connectToContracts } from "./contractConnector";

const MAX_UINT256 = new Decimal(
  bigNumberify(2)
    .pow(256)
    .sub(1)
);

export const calculateICR = (coll: Decimalish, price: Decimalish, debt: Decimalish): Decimal => {
  if (Decimal.from(debt).isZero()) return MAX_UINT256;

  return Decimal.from(coll).mulDiv(price, debt);
};

export type Trove = {
  collateral: Decimal;
  debt: Decimal;
};

enum CDPStatus {
  nonExistent,
  active,
  closed
}

export class Liquity {
  private readonly contracts: LiquityContracts;
  public userAddress?: string;

  private constructor(contracts: LiquityContracts, userAddress?: string) {
    this.contracts = contracts;
    this.userAddress = userAddress;
  }

  public static connect(
    addresses: LiquityContractAddresses,
    provider: Web3Provider,
    userAddress?: string
  ) {
    if (userAddress) {
      return new Liquity(
        connectToContracts(addresses, provider.getSigner(userAddress)),
        userAddress
      );
    } else {
      return new Liquity(connectToContracts(addresses, provider));
    }
  }

  private backfillAddress(address?: string): string {
    if (!address) {
      address = this.userAddress;
      if (!address) {
        throw Error("An address is required");
      }
    }
    return address;
  }

  public async getTrove(address?: string): Promise<Trove | undefined> {
    address = this.backfillAddress(address);
    const cdp = await this.contracts.cdpManager.CDPs(address);

    if (cdp.status === CDPStatus.active) {
      return {
        collateral: new Decimal(cdp.coll),
        debt: new Decimal(cdp.debt)
      };
    }
  }

  public watchTrove(onTroveChanged: (trove: Trove | undefined) => void, address?: string) {
    const cdpManager = this.contracts.cdpManager;
    const { CDPCreated, CDPUpdated, CDPClosed } = this.contracts.cdpManager.filters;

    address = this.backfillAddress(address);

    const cdpCreated = CDPCreated(address, null);
    const cdpUpdated = CDPUpdated(address, null, null, null, null);
    const cdpClosed = CDPClosed(address);

    const onCdpCreated = () => {
      onTroveChanged({ collateral: Decimal.from(0), debt: Decimal.from(0) });
    };
    const onCdpUpdated = (_address: string, debt: BigNumber, collateral: BigNumber) => {
      onTroveChanged({ collateral: new Decimal(collateral), debt: new Decimal(debt) });
    };
    const onCdpClosed = () => {
      onTroveChanged(undefined);
    };

    cdpManager.on(cdpCreated, onCdpCreated);
    cdpManager.on(cdpUpdated, onCdpUpdated);
    cdpManager.on(cdpClosed, onCdpClosed);

    return () => {
      cdpManager.removeListener(cdpCreated, onCdpCreated);
      cdpManager.removeListener(cdpUpdated, onCdpUpdated);
      cdpManager.removeListener(cdpClosed, onCdpClosed);
    };
  }

  public async createTrove(trove: Trove, address?: string) {
    address = this.backfillAddress(address);

    const addCollTx = this.contracts.cdpManager.addColl(address, address, {
      value: trove.collateral.bigNumber
    });

    if (trove.debt.isZero()) {
      return addCollTx;
    } else {
      await addCollTx;
      return this.contracts.cdpManager.withdrawCLV(trove.debt.bigNumber, address);
    }
  }
}
