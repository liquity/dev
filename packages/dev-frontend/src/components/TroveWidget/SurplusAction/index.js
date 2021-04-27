import { useEffect } from "react";

import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../../hooks/LiquityContext";

import { Transaction, useMyTransactionState } from "../../Transaction";
import { useTroveView } from "../context/TroveViewContext";

import Button from "../../Button";

import classes from "./SurplusAction.module.css";

const select = ({ collateralSurplusBalance }) => ({
  collateralSurplusBalance
});

const SurplusAction = () => {
  const { collateralSurplusBalance } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "claim-coll-surplus";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const { dispatchEvent } = useTroveView();

  useEffect(() => {
    if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_SURPLUS_COLLATERAL_CLAIMED");
    }
  }, [myTransactionState.type, dispatchEvent]);

  return myTransactionState.type === "waitingForApproval" ? (
    <div className={classes.center}>
      <Button primary round large disabled>
        Waiting for your approval
      </Button>
    </div>
  ) : myTransactionState.type !== "waitingForConfirmation" &&
    myTransactionState.type !== "confirmed" ? (
    <div className={classes.center}>
      <Transaction
        id={myTransactionId}
        send={liquity.claimCollateralSurplus.bind(liquity, undefined)}
      >
        <Button primary round large sx={{ mx: 2 }}>
          Claim {collateralSurplusBalance.prettify()} ETH
        </Button>
      </Transaction>
    </div>
  ) : null;
};

export default SurplusAction;
