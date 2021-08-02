import {
  Decimal,
  LiquityStoreState,
  StabilityDeposit,
  StabilityDepositChange
} from "@liquity/lib-base";

import {
  Difference
} from "@liquity/lib-base";

import { COIN } from "../../../strings";
import { Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";
import { StabilityActionDescription } from "../StabilityActionDescription";
import { UnlockButton } from "../NoDeposit"

export const selectForStabilityDepositChangeValidation = ({
  trove,
  lusdBalance,
  ownFrontend,
  haveUndercollateralizedTroves,
  bammAllowance
}: any) => ({
  trove,
  lusdBalance,
  haveOwnFrontend: ownFrontend.status === "registered",
  haveUndercollateralizedTroves,
  bammAllowance
});

type StabilityDepositChangeValidationContext = ReturnType<
  typeof selectForStabilityDepositChangeValidation
>;

export const validateStabilityDepositChange = (
  originalDeposit: StabilityDeposit,
  editedLUSD: Decimal,
  {
    lusdBalance,
    haveOwnFrontend,
    haveUndercollateralizedTroves,
    bammAllowance
  }: StabilityDepositChangeValidationContext,
  lusdDiff: Difference| undefined,
  ethDiff: Difference| undefined,
): [
  validChange: StabilityDepositChange<Decimal> | undefined,
  description: JSX.Element | undefined
] => {
  const change = originalDeposit.whatChanged(editedLUSD);

  if (haveOwnFrontend) {
    return [
      undefined,
      <ErrorDescription>
        You can’t deposit using a wallet address that is registered as a frontend.
      </ErrorDescription>
    ];
  }

  if (!change) {
    return [undefined, undefined];
  }

  if (change.depositLUSD?.gt(lusdBalance)) {
    return [
      undefined,
      <ErrorDescription>
        The amount you're trying to deposit exceeds your balance by{" "}
        <Amount>
          {change.depositLUSD.sub(lusdBalance).prettify()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  if(change && !bammAllowance) {
    return [
      undefined,
      <ErrorDescription>
        You have no allowance. {" "}
        <UnlockButton>
          click here to unlock.
        </UnlockButton>
      </ErrorDescription>
    ];
  }

  if (change.withdrawLUSD && haveUndercollateralizedTroves) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to withdraw LUSD from your Stability Deposit when there are
        undercollateralized Troves. Please liquidate those Troves or try again later.
      </ErrorDescription>
    ];
  }

  return [change, <StabilityActionDescription lusdDiff={lusdDiff} ethDiff={ethDiff} originalDeposit={originalDeposit} change={change} />];
};
