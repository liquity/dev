import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal, StabilityDeposit, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { COIN } from "../../strings";
import { Transaction, useMyTransactionState } from "../Transaction";
import { useStabilityView } from "./context/StabilityViewContext";

type StabilityDepositActionProps = {
  originalDeposit: StabilityDeposit;
  editedLUSD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const select = ({
  trove,
  lusdBalance,
  frontend,
  ownFrontend,
  haveUndercollateralizedTroves
}: LiquityStoreState) => ({
  trove,
  lusdBalance,
  frontendRegistered: frontend.status === "registered",
  noOwnFrontend: ownFrontend.status === "unregistered",
  haveUndercollateralizedTroves
});

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  originalDeposit,
  editedLUSD,
  dispatch
}) => {
  const {
    lusdBalance,
    frontendRegistered,
    noOwnFrontend,
    haveUndercollateralizedTroves
  } = useLiquitySelector(select);

  const {
    config,
    liquity: { send: liquity }
  } = useLiquity();

  const { dispatchEvent } = useStabilityView();
  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const { depositLUSD, withdrawLUSD } = originalDeposit.whatChanged(editedLUSD) ?? {};

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("DEPOSIT_CONFIRMED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  if (!depositLUSD && !withdrawLUSD) {
    return <Button disabled>Confirm</Button>;
  }

  if (depositLUSD) {
    return (
      <>
        <Transaction
          id={myTransactionId}
          send={liquity.depositLUSDInStabilityPool.bind(liquity, depositLUSD, frontendTag)}
          requires={[
            [noOwnFrontend, "Address registered as frontend"],
            [lusdBalance.gte(depositLUSD), `You don't have enough ${COIN}`]
          ]}
          failureDisplayType="asTooltip"
          tooltipPlacement="bottom"
        >
          <Button>Confirm</Button>
        </Transaction>
      </>
    );
  }

  if (withdrawLUSD) {
    return (
      <>
        <Transaction
          id={myTransactionId}
          send={liquity.withdrawLUSDFromStabilityPool.bind(liquity, withdrawLUSD)}
          requires={[
            [
              !haveUndercollateralizedTroves,
              "You can't withdraw when there are undercollateralized Troves"
            ]
          ]}
          failureDisplayType="asTooltip"
          tooltipPlacement="bottom"
        >
          <Button>Confirm</Button>
        </Transaction>
      </>
    );
  }

  return null;
};
