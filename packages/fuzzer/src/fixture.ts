import { Signer } from "@ethersproject/abstract-signer";

import {
  Decimal,
  Decimalish,
  STBLStake,
  XBRL_MINIMUM_DEBT,
  StabilityDeposit,
  TransactableStabilio,
  Trove,
  TroveAdjustmentParams
} from "@stabilio/lib-base";

import { EthersStabilio as Stabilio } from "@stabilio/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference,
  getListOfTroves,
  randomCollateralChange,
  randomDebtChange,
  objToString
} from "./utils";

import { GasHistogram } from "./GasHistogram";

type _GasHistogramsFrom<T> = {
  [P in keyof T]: T[P] extends (...args: never[]) => Promise<infer R> ? GasHistogram<R> : never;
};

type GasHistograms = Pick<
  _GasHistogramsFrom<TransactableStabilio>,
  | "openTrove"
  | "adjustTrove"
  | "closeTrove"
  | "redeemXBRL"
  | "depositXBRLInStabilityPool"
  | "withdrawXBRLFromStabilityPool"
  | "stakeSTBL"
  | "unstakeSTBL"
>;

export class Fixture {
  private readonly deployerStabilio: Stabilio;
  private readonly funder: Signer;
  private readonly funderStabilio: Stabilio;
  private readonly funderAddress: string;
  private readonly frontendAddress: string;
  private readonly gasHistograms: GasHistograms;

  private price: Decimal;

  totalNumberOfLiquidations = 0;

  private constructor(
    deployerStabilio: Stabilio,
    funder: Signer,
    funderStabilio: Stabilio,
    funderAddress: string,
    frontendAddress: string,
    price: Decimal
  ) {
    this.deployerStabilio = deployerStabilio;
    this.funder = funder;
    this.funderStabilio = funderStabilio;
    this.funderAddress = funderAddress;
    this.frontendAddress = frontendAddress;
    this.price = price;

    this.gasHistograms = {
      openTrove: new GasHistogram(),
      adjustTrove: new GasHistogram(),
      closeTrove: new GasHistogram(),
      redeemXBRL: new GasHistogram(),
      depositXBRLInStabilityPool: new GasHistogram(),
      withdrawXBRLFromStabilityPool: new GasHistogram(),
      stakeSTBL: new GasHistogram(),
      unstakeSTBL: new GasHistogram()
    };
  }

  static async setup(
    deployerStabilio: Stabilio,
    funder: Signer,
    funderStabilio: Stabilio,
    frontendAddress: string,
    frontendStabilio: Stabilio
  ) {
    const funderAddress = await funder.getAddress();
    const price = await deployerStabilio.getPrice();

    await frontendStabilio.registerFrontend(Decimal.from(10).div(11));

    return new Fixture(
      deployerStabilio,
      funder,
      funderStabilio,
      funderAddress,
      frontendAddress,
      price
    );
  }

  private async sendXBRLFromFunder(toAddress: string, amount: Decimalish) {
    amount = Decimal.from(amount);

    const xbrlBalance = await this.funderStabilio.getXBRLBalance();

    if (xbrlBalance.lt(amount)) {
      const trove = await this.funderStabilio.getTrove();
      const total = await this.funderStabilio.getTotal();
      const fees = await this.funderStabilio.getFees();

      const targetCollateralRatio =
        trove.isEmpty || !total.collateralRatioIsBelowCritical(this.price)
          ? 1.51
          : Decimal.max(trove.collateralRatio(this.price).add(0.00001), 1.11);

      let newTrove = trove.isEmpty ? Trove.create({ depositCollateral: 1, borrowXBRL: 0 }) : trove;
      newTrove = newTrove.adjust({ borrowXBRL: amount.sub(xbrlBalance).mul(2) });

      if (newTrove.debt.lt(XBRL_MINIMUM_DEBT)) {
        newTrove = newTrove.setDebt(XBRL_MINIMUM_DEBT);
      }

      newTrove = newTrove.setCollateral(newTrove.debt.mulDiv(targetCollateralRatio, this.price));

      if (trove.isEmpty) {
        const params = Trove.recreate(newTrove, fees.borrowingRate());
        console.log(`[funder] openTrove(${objToString(params)})`);
        await this.funderStabilio.openTrove(params);
      } else {
        let newTotal = total.add(newTrove).subtract(trove);

        if (
          !total.collateralRatioIsBelowCritical(this.price) &&
          newTotal.collateralRatioIsBelowCritical(this.price)
        ) {
          newTotal = newTotal.setCollateral(newTotal.debt.mulDiv(1.51, this.price));
          newTrove = trove.add(newTotal).subtract(total);
        }

        const params = trove.adjustTo(newTrove, fees.borrowingRate());
        console.log(`[funder] adjustTrove(${objToString(params)})`);
        await this.funderStabilio.adjustTrove(params);
      }
    }

    await this.funderStabilio.sendXBRL(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(200 * Math.random() + 100).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerStabilio.setPrice(this.price);

    return this.price;
  }

  async liquidateRandomNumberOfTroves(price: Decimal) {
    const xbrlInStabilityPoolBefore = await this.deployerStabilio.getXBRLInStabilityPool();
    console.log(`// Stability Pool balance: ${xbrlInStabilityPoolBefore}`);

    const trovesBefore = await getListOfTroves(this.deployerStabilio);

    if (trovesBefore.length === 0) {
      console.log("// No Troves to liquidate");
      return;
    }

    const troveOwnersBefore = trovesBefore.map(trove => trove.ownerAddress);
    const lastTrove = trovesBefore[trovesBefore.length - 1];

    if (!lastTrove.collateralRatioIsBelowMinimum(price)) {
      console.log("// No Troves to liquidate");
      return;
    }

    const maximumNumberOfTrovesToLiquidate = Math.floor(50 * Math.random()) + 1;
    console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
    await this.deployerStabilio.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

    const troveOwnersAfter = await getListOfTroveOwners(this.deployerStabilio);
    const liquidatedTroves = listDifference(troveOwnersBefore, troveOwnersAfter);

    if (liquidatedTroves.length > 0) {
      for (const liquidatedTrove of liquidatedTroves) {
        console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
      }
    }

    this.totalNumberOfLiquidations += liquidatedTroves.length;

    const xbrlInStabilityPoolAfter = await this.deployerStabilio.getXBRLInStabilityPool();
    console.log(`// Stability Pool balance: ${xbrlInStabilityPoolAfter}`);
  }

  async openRandomTrove(userAddress: string, stabilio: Stabilio) {
    const total = await stabilio.getTotal();
    const fees = await stabilio.getFees();

    let newTrove: Trove;

    const cannotOpen = (newTrove: Trove) =>
      newTrove.debt.lt(XBRL_MINIMUM_DEBT) ||
      (total.collateralRatioIsBelowCritical(this.price)
        ? !newTrove.isOpenableInRecoveryMode(this.price)
        : newTrove.collateralRatioIsBelowMinimum(this.price) ||
          total.add(newTrove).collateralRatioIsBelowCritical(this.price));

    // do {
    newTrove = createRandomTrove(this.price);
    // } while (cannotOpen(newTrove));

    await this.funder.sendTransaction({
      to: userAddress,
      value: newTrove.collateral.hex
    });

    const params = Trove.recreate(newTrove, fees.borrowingRate());

    if (cannotOpen(newTrove)) {
      console.log(
        `// [${shortenAddress(userAddress)}] openTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.openTrove.expectFailure(() =>
        stabilio.openTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] openTrove(${objToString(params)})`);

      await this.gasHistograms.openTrove.expectSuccess(() =>
        stabilio.send.openTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async randomlyAdjustTrove(userAddress: string, stabilio: Stabilio, trove: Trove) {
    const total = await stabilio.getTotal();
    const fees = await stabilio.getFees();
    const x = Math.random();

    const params: TroveAdjustmentParams<Decimal> =
      x < 0.333
        ? randomCollateralChange(trove)
        : x < 0.666
        ? randomDebtChange(trove)
        : { ...randomCollateralChange(trove), ...randomDebtChange(trove) };

    const cannotAdjust = (trove: Trove, params: TroveAdjustmentParams<Decimal>) => {
      if (
        params.withdrawCollateral?.gte(trove.collateral) ||
        params.repayXBRL?.gt(trove.debt.sub(XBRL_MINIMUM_DEBT))
      ) {
        return true;
      }

      const adjusted = trove.adjust(params, fees.borrowingRate());

      return (
        (params.withdrawCollateral?.nonZero || params.borrowXBRL?.nonZero) &&
        (adjusted.collateralRatioIsBelowMinimum(this.price) ||
          (total.collateralRatioIsBelowCritical(this.price)
            ? adjusted._nominalCollateralRatio.lt(trove._nominalCollateralRatio)
            : total.add(adjusted).subtract(trove).collateralRatioIsBelowCritical(this.price)))
      );
    };

    if (params.depositCollateral) {
      await this.funder.sendTransaction({
        to: userAddress,
        value: params.depositCollateral.hex
      });
    }

    if (params.repayXBRL) {
      await this.sendXBRLFromFunder(userAddress, params.repayXBRL);
    }

    if (cannotAdjust(trove, params)) {
      console.log(
        `// [${shortenAddress(userAddress)}] adjustTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.adjustTrove.expectFailure(() =>
        stabilio.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] adjustTrove(${objToString(params)})`);

      await this.gasHistograms.adjustTrove.expectSuccess(() =>
        stabilio.send.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async closeTrove(userAddress: string, stabilio: Stabilio, trove: Trove) {
    const total = await stabilio.getTotal();

    if (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      console.log("// Skipping closeTrove() in recovery mode");
      return;
    }

    await this.sendXBRLFromFunder(userAddress, trove.netDebt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);

    await this.gasHistograms.closeTrove.expectSuccess(() =>
      stabilio.send.closeTrove({ gasPrice: 0 })
    );
  }

  async redeemRandomAmount(userAddress: string, stabilio: Stabilio) {
    const total = await stabilio.getTotal();

    if (total.collateralRatioIsBelowMinimum(this.price)) {
      console.log("// Skipping redeemXBRL() when TCR < MCR");
      return;
    }

    const amount = benford(10000);
    await this.sendXBRLFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemXBRL(${amount})`);

    try {
      await this.gasHistograms.redeemXBRL.expectSuccess(() =>
        stabilio.send.redeemXBRL(amount, undefined, { gasPrice: 0 })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("amount too low to redeem")) {
        console.log("// amount too low to redeem");
      } else {
        throw error;
      }
    }
  }

  async depositRandomAmountInStabilityPool(userAddress: string, stabilio: Stabilio) {
    const amount = benford(20000);

    await this.sendXBRLFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositXBRLInStabilityPool(${amount})`);

    await this.gasHistograms.depositXBRLInStabilityPool.expectSuccess(() =>
      stabilio.send.depositXBRLInStabilityPool(amount, this.frontendAddress, {
        gasPrice: 0
      })
    );
  }

  async withdrawRandomAmountFromStabilityPool(
    userAddress: string,
    stabilio: Stabilio,
    deposit: StabilityDeposit
  ) {
    const [lastTrove] = await stabilio.getTroves({
      first: 1,
      sortedBy: "ascendingCollateralRatio"
    });

    const amount = deposit.currentXBRL.mul(1.1 * Math.random()).add(10 * Math.random());

    const cannotWithdraw = (amount: Decimal) =>
      amount.nonZero && lastTrove.collateralRatioIsBelowMinimum(this.price);

    if (cannotWithdraw(amount)) {
      console.log(
        `// [${shortenAddress(userAddress)}] ` +
          `withdrawXBRLFromStabilityPool(${amount}) expected to fail`
      );

      await this.gasHistograms.withdrawXBRLFromStabilityPool.expectFailure(() =>
        stabilio.withdrawXBRLFromStabilityPool(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] withdrawXBRLFromStabilityPool(${amount})`);

      await this.gasHistograms.withdrawXBRLFromStabilityPool.expectSuccess(() =>
        stabilio.send.withdrawXBRLFromStabilityPool(amount, { gasPrice: 0 })
      );
    }
  }

  async stakeRandomAmount(userAddress: string, stabilio: Stabilio) {
    const stblBalance = await this.funderStabilio.getSTBLBalance();
    const amount = stblBalance.mul(Math.random() / 2);

    await this.funderStabilio.sendSTBL(userAddress, amount);

    if (amount.eq(0)) {
      console.log(`// [${shortenAddress(userAddress)}] stakeSTBL(${amount}) expected to fail`);

      await this.gasHistograms.stakeSTBL.expectFailure(() =>
        stabilio.stakeSTBL(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] stakeSTBL(${amount})`);

      await this.gasHistograms.stakeSTBL.expectSuccess(() =>
        stabilio.send.stakeSTBL(amount, { gasPrice: 0 })
      );
    }
  }

  async unstakeRandomAmount(userAddress: string, stabilio: Stabilio, stake: STBLStake) {
    const amount = stake.stakedSTBL.mul(1.1 * Math.random()).add(10 * Math.random());

    console.log(`[${shortenAddress(userAddress)}] unstakeSTBL(${amount})`);

    await this.gasHistograms.unstakeSTBL.expectSuccess(() =>
      stabilio.send.unstakeSTBL(amount, { gasPrice: 0 })
    );
  }

  async sweepXBRL(stabilio: Stabilio) {
    const xbrlBalance = await stabilio.getXBRLBalance();

    if (xbrlBalance.nonZero) {
      await stabilio.sendXBRL(this.funderAddress, xbrlBalance, { gasPrice: 0 });
    }
  }

  async sweepSTBL(stabilio: Stabilio) {
    const stblBalance = await stabilio.getSTBLBalance();

    if (stblBalance.nonZero) {
      await stabilio.sendSTBL(this.funderAddress, stblBalance, { gasPrice: 0 });
    }
  }

  summarizeGasStats(): string {
    return Object.entries(this.gasHistograms)
      .map(([name, histo]) => {
        const results = histo.getResults();

        return (
          `${name},outOfGas,${histo.outOfGasFailures}\n` +
          `${name},failure,${histo.expectedFailures}\n` +
          results
            .map(([intervalMin, frequency]) => `${name},success,${frequency},${intervalMin}\n`)
            .join("")
        );
      })
      .join("");
  }
}
