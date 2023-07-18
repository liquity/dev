import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({
  xbrlWethUniTokenBalance,
  xbrlWethUniTokenAllowance,
  xbrlWethLiquidityMiningStake
}: LiquityStoreState) => ({
  xbrlWethUniTokenBalance,
  xbrlWethUniTokenAllowance,
  xbrlWethLiquidityMiningStake
});

type FarmStakeValidation = {
  isValid: boolean;
  hasApproved: boolean;
  hasEnoughUniToken: boolean;
  isWithdrawing: boolean;
  amountChanged: Decimal;
  maximumStake: Decimal;
  hasSetMaximumStake: boolean;
};

export const useValidationState = (amount: Decimal): FarmStakeValidation => {
  const { xbrlWethUniTokenBalance, xbrlWethUniTokenAllowance, xbrlWethLiquidityMiningStake } = useLiquitySelector(selector);
  const isWithdrawing = xbrlWethLiquidityMiningStake.gt(amount);
  const amountChanged = isWithdrawing
    ? xbrlWethLiquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(xbrlWethLiquidityMiningStake);
  const maximumStake = xbrlWethLiquidityMiningStake.add(xbrlWethUniTokenBalance);
  const hasSetMaximumStake = amount.eq(maximumStake);

  if (isWithdrawing) {
    return {
      isValid: true,
      hasApproved: true,
      hasEnoughUniToken: true,
      isWithdrawing,
      amountChanged,
      maximumStake,
      hasSetMaximumStake
    };
  }

  const hasApproved = !xbrlWethUniTokenAllowance.isZero && xbrlWethUniTokenAllowance.gte(amountChanged);
  const hasEnoughUniToken = !xbrlWethUniTokenBalance.isZero && xbrlWethUniTokenBalance.gte(amountChanged);

  return {
    isValid: hasApproved && hasEnoughUniToken,
    hasApproved,
    hasEnoughUniToken,
    isWithdrawing,
    amountChanged,
    maximumStake,
    hasSetMaximumStake
  };
};
