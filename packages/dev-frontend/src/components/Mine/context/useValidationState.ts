import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ uniTokenBalance, uniTokenAllowance }: LiquityStoreState) => ({
  uniTokenBalance,
  uniTokenAllowance
});

type MineStakeValidation = {
  hasApproved: boolean;
  hasEnoughUniToken: boolean;
};

export const useValidationState = (amount: Decimal): MineStakeValidation => {
  const { uniTokenBalance, uniTokenAllowance } = useLiquitySelector(selector);
  const hasApproved = uniTokenAllowance.gte(amount);
  const hasEnoughUniToken = uniTokenBalance.gte(amount);

  return {
    hasApproved,
    hasEnoughUniToken
  };
};
