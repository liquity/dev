import { ContractTransaction } from "ethers";
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

export class Trove {
  public readonly collateral: Decimal;
  public readonly debt: Decimal;

  public constructor(collateral: Decimalish = 0, debt: Decimalish = 0) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
  }

  public addCollateral(addedCollateral: Decimalish) {
    return new Trove(this.collateral.add(addedCollateral), this.debt);
  }

  public addDebt(addedDebt: Decimalish) {
    return new Trove(this.collateral, this.debt.add(addedDebt));
  }

  public subtractCollateral(subtractedCollateral: Decimalish) {
    return new Trove(this.collateral.sub(subtractedCollateral), this.debt);
  }

  public subtractDebt(subtractedDebt: Decimalish) {
    return new Trove(this.collateral, this.debt.sub(subtractedDebt));
  }
}

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

  private requireAddress(): string {
    if (!this.userAddress) {
      throw Error("An address is required");
    }
    return this.userAddress;
  }

  public async getTrove(address = this.requireAddress()): Promise<Trove | undefined> {
    const { cdpManager } = this.contracts;

    const cdp = await cdpManager.CDPs(address);

    if (cdp.status === CDPStatus.active) {
      return new Trove(new Decimal(cdp.coll), new Decimal(cdp.debt));
    }
  }

  public watchTrove(
    onTroveChanged: (trove: Trove | undefined) => void,
    address = this.requireAddress()
  ) {
    const { cdpManager } = this.contracts;
    const { CDPCreated, CDPUpdated, CDPClosed } = cdpManager.filters;

    const cdpCreated = CDPCreated(address, null);
    const cdpUpdated = CDPUpdated(address, null, null, null, null);
    const cdpClosed = CDPClosed(address);

    const cdpCreatedListener = () => {
      onTroveChanged(new Trove());
    };
    const cdpUpdatedListener = (_address: string, debt: BigNumber, collateral: BigNumber) => {
      onTroveChanged(new Trove(new Decimal(collateral), new Decimal(debt)));
    };
    const cdpClosedListener = () => {
      onTroveChanged(undefined);
    };

    cdpManager.on(cdpCreated, cdpCreatedListener);
    cdpManager.on(cdpUpdated, cdpUpdatedListener);
    cdpManager.on(cdpClosed, cdpClosedListener);

    return () => {
      cdpManager.removeListener(cdpCreated, cdpCreatedListener);
      cdpManager.removeListener(cdpUpdated, cdpUpdatedListener);
      cdpManager.removeListener(cdpClosed, cdpClosedListener);
    };
  }

  private async findHint(trove: Trove, address: string) {
    // TODO: implement
    return address;
  }

  public async createTrove(trove: Trove) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();

    return cdpManager.openLoan(trove.debt.bigNumber, await this.findHint(trove, address), {
      value: trove.collateral.bigNumber
    });
  }

  public async depositEther(
    initialTrove: Trove,
    depositedEther: Decimalish,
    address = this.requireAddress()
  ) {
    const { cdpManager } = this.contracts;
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return cdpManager.addColl(address, await this.findHint(finalTrove, address), {
      value: Decimal.from(depositedEther).bigNumber
    });
  }

  public async withdrawEther(initialTrove: Trove, withdrawnEther: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return cdpManager.withdrawColl(
      Decimal.from(withdrawnEther).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }

  public async borrowQui(initialTrove: Trove, borrowedQui: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return cdpManager.withdrawCLV(
      Decimal.from(borrowedQui).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }

  public async repayQui(initialTrove: Trove, repaidQui: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return cdpManager.repayCLV(
      Decimal.from(repaidQui).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }
}
