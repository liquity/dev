import React from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";

import { Transaction, useMyTransactionState } from "./Transaction";

const select = ({ collateralSurplusBalance }: LiquityStoreState) => ({ collateralSurplusBalance });

export const CollateralSurplusAction: React.FC = () => {
  const { collateralSurplusBalance } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "claim-coll-surplus";
  const myTransactionState = useMyTransactionState(myTransactionId);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : myTransactionState.type !== "waitingForConfirmation" &&
    myTransactionState.type !== "confirmed" ? (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        send={liquity.claimCollateralSurplus.bind(liquity, undefined)}
      >
        <Button sx={{ mx: 2 }}>Claim {collateralSurplusBalance.prettify()} ETH</Button>
      </Transaction>
    </Flex>
  ) : null;
};
