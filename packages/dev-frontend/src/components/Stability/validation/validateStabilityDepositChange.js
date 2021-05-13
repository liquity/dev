import { COIN } from "../../../strings";
import { Amount } from "../../Amount";
import ErrorDescription from "../../ErrorDescription";

export const selectForStabilityDepositChangeValidation = ({
  trove,
  lusdBalance,
  ownFrontend,
  haveUndercollateralizedTroves,
  lusdInStabilityPool
}) => ({
  trove,
  lusdBalance,
  haveOwnFrontend: ownFrontend.status === "registered",
  haveUndercollateralizedTroves,
  lusdInStabilityPool
});

export const validateStabilityDepositChange = (
  originalDeposit,
  editedLUSD,
  { lusdBalance, haveOwnFrontend, haveUndercollateralizedTroves }
) => {
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

  if (change.withdrawLUSD && haveUndercollateralizedTroves) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to withdraw LUSD from your Stability Deposit when there are
        undercollateralized Troves. Please liquidate those Troves or try again later.
      </ErrorDescription>
    ];
  }

  return [change, undefined];
};
