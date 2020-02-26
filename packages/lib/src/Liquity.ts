import { Signer } from "ethers";
import { Provider } from "ethers/providers";
import { bigNumberify } from "ethers/utils";

import { Decimal, Decimalish } from "../utils/Decimal";
import { LiquityContractAddresses, LiquityContracts } from "./contracts";
import { connectToContracts, getContractsFromNameRegistry } from "./contractConnector";

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
  public provider?: Provider;
  public signer?: Signer;

  private constructor(contracts: LiquityContracts, signerOrProvider: Signer | Provider) {
    this.contracts = contracts;
    if (Signer.isSigner(signerOrProvider)) {
      this.signer = signerOrProvider;
      this.provider = signerOrProvider.provider;
    } else {
      this.provider = signerOrProvider;
    }
  }

  public static connect(addresses: LiquityContractAddresses, signerOrProvider: Signer | Provider) {
    return new Liquity(connectToContracts(addresses, signerOrProvider), signerOrProvider);
  }

  public static async connectUsingNameRegistry(
    nameRegistryAddress: string,
    signerOrProvider: Signer | Provider
  ) {
    return new Liquity(
      await getContractsFromNameRegistry(nameRegistryAddress, signerOrProvider),
      signerOrProvider
    );
  }

  private async getAddress(address?: string) {
    if (!address) {
      address = await this.signer?.getAddress();
      if (!address) {
        throw Error("An address is required");
      }
    }
    return address;
  }

  public async getTrove(address?: string): Promise<Trove | undefined> {
    address = await this.getAddress(address);
    const cdp = await this.contracts.cdpManager.CDPs(address);

    if (cdp.status === CDPStatus.active) {
      return {
        collateral: new Decimal(cdp.coll),
        debt: new Decimal(cdp.debt)
      };
    }
  }

  public async createTrove(trove: Trove, address?: string) {
    address = await this.getAddress(address);

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
