import { Wallet } from "@ethersproject/wallet";

import { Decimal, XBRL_MINIMUM_DEBT, Trove } from "@stabilio/lib-base";
import { EthersStabilio } from "@stabilio/lib-ethers";

import { deployer, funder, provider } from "../globals";

export interface WarzoneParams {
  troves: number;
}

export const warzone = async ({ troves: numberOfTroves }: WarzoneParams) => {
  const deployerStabilio = await EthersStabilio.connect(deployer);

  const price = await deployerStabilio.getPrice();

  for (let i = 1; i <= numberOfTroves; ++i) {
    const user = Wallet.createRandom().connect(provider);
    const userAddress = await user.getAddress();
    const debt = XBRL_MINIMUM_DEBT.add(99999 * Math.random());
    const collateral = debt.mulDiv(1.11 + 3 * Math.random(), price);

    const stabilio = await EthersStabilio.connect(user);

    await funder.sendTransaction({
      to: userAddress,
      value: Decimal.from(collateral).hex
    });

    const fees = await stabilio.getFees();

    await stabilio.openTrove(
      Trove.recreate(new Trove(collateral, debt), fees.borrowingRate()),
      { borrowingFeeDecayToleranceMinutes: 0 },
      { gasPrice: 0 }
    );

    if (i % 4 === 0) {
      const xbrlBalance = await stabilio.getXBRLBalance();
      await stabilio.depositXBRLInStabilityPool(xbrlBalance);
    }

    if (i % 10 === 0) {
      console.log(`Created ${i} Troves.`);
    }

    //await new Promise(resolve => setTimeout(resolve, 4000));
  }
};
