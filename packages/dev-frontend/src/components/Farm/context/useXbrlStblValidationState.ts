import { Decimal, StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

const selector = ({
  xbrlStblUniTokenBalance,
  xbrlStblUniTokenAllowance,
  xbrlStblLiquidityMiningStake
}: StabilioStoreState) => ({
  xbrlStblUniTokenBalance,
  xbrlStblUniTokenAllowance,
  xbrlStblLiquidityMiningStake
});

type XbrlStblFarmStakeValidation = {
  isValid: boolean;
  hasApproved: boolean;
  hasEnoughUniToken: boolean;
  isWithdrawing: boolean;
  amountChanged: Decimal;
  maximumStake: Decimal;
  hasSetMaximumStake: boolean;
};

export const useXbrlStblValidationState = (amount: Decimal): XbrlStblFarmStakeValidation => {
  const { xbrlStblUniTokenBalance, xbrlStblUniTokenAllowance, xbrlStblLiquidityMiningStake } = useStabilioSelector(selector);
  const isWithdrawing = xbrlStblLiquidityMiningStake.gt(amount);
  const amountChanged = isWithdrawing
    ? xbrlStblLiquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(xbrlStblLiquidityMiningStake);
  const maximumStake = xbrlStblLiquidityMiningStake.add(xbrlStblUniTokenBalance);
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

  const hasApproved = !xbrlStblUniTokenAllowance.isZero && xbrlStblUniTokenAllowance.gte(amountChanged);
  const hasEnoughUniToken = !xbrlStblUniTokenBalance.isZero && xbrlStblUniTokenBalance.gte(amountChanged);

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
