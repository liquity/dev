import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";

import { Liquity, StabilityDeposit, Trove } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { Transaction, useMyTransactionState } from "./Transaction";

type StabilityDepositActionProps = {
  liquity: Liquity;
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  trove: Trove;
  price: Decimal;
};

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  liquity,
  originalDeposit,
  editedDeposit,
  changePending,
  setChangePending,
  trove,
  price
}) => {
  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const difference = originalDeposit.calculateDifference(editedDeposit);

  useEffect(() => {
    if (myTransactionState.type === "idle") {
      setChangePending(false);
    } else if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!difference && (originalDeposit.pendingCollateralGain.isZero || trove.isEmpty)) {
    return null;
  }

  const [actionName, send] = difference
    ? [
        `${
          difference.positive ? "Deposit" : "Withdraw"
        } ${difference.absoluteValue!.prettify()} QUI`,
        (difference.positive
          ? liquity.depositQuiInStabilityPool
          : liquity.withdrawQuiFromStabilityPool
        ).bind(liquity, difference.absoluteValue!)
      ]
    : [
        `Transfer ${originalDeposit.pendingCollateralGain.prettify(4)} ETH to Trove`,
        liquity.transferCollateralGainToTrove.bind(liquity, originalDeposit, trove, price)
      ];

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex mt={4} justifyContent="center">
      <Button disabled mx={2}>
        <Loader mr={2} color="white" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex mt={4} justifyContent="center">
      <Transaction id={myTransactionId} {...{ send }}>
        <Button mx={2}>{actionName}</Button>
      </Transaction>
    </Flex>
  );
};

type StabilityDepositManagerProps = {
  liquity: Liquity;
  deposit: StabilityDeposit;
  trove: Trove;
  price: Decimal;
};

export const StabilityDepositManager: React.FC<StabilityDepositManagerProps> = ({
  liquity,
  deposit,
  trove,
  price
}) => {
  const originalDeposit = deposit;
  const [editedDeposit, setEditedDeposit] = useState(deposit);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setEditedDeposit(deposit);
    setChangePending(false);
  }, [deposit]);

  return (
    <>
      <Box mt={4}>
        <StabilityDepositEditor
          title={deposit.isEmpty ? "Make a Stability Deposit" : "Your Stability Deposit"}
          {...{ originalDeposit, editedDeposit, setEditedDeposit, changePending }}
        />
      </Box>

      <StabilityDepositAction
        {...{
          liquity,
          originalDeposit,
          editedDeposit,
          changePending,
          setChangePending,
          trove,
          price
        }}
      />
    </>
  );
};
