import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";

import { Decimal } from "@liquity/decimal";
import { Liquity, StabilityDeposit, Trove } from "@liquity/lib";
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
  quiBalance: Decimal;
};

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  liquity,
  originalDeposit,
  editedDeposit,
  changePending,
  setChangePending,
  trove,
  price,
  quiBalance
}) => {
  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const difference = originalDeposit.calculateDifference(editedDeposit);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!difference && (originalDeposit.pendingCollateralGain.isZero || trove.isEmpty)) {
    return null;
  }

  const [actionName, send, requires] = difference
    ? difference.positive
      ? ([
          `Deposit ${difference.absoluteValue!.prettify()} LQTY`,
          liquity.depositQuiInStabilityPool.bind(liquity, difference.absoluteValue!),
          [[quiBalance.gte(difference.absoluteValue!), "You don't have enough LQTY"]]
        ] as const)
      : ([
          `Withdraw ${difference.absoluteValue!.prettify()} LQTY`,
          liquity.withdrawQuiFromStabilityPool.bind(liquity, difference.absoluteValue!),
          []
        ] as const)
    : ([
        `Transfer ${originalDeposit.pendingCollateralGain.prettify(4)} ETH to Trove`,
        liquity.transferCollateralGainToTrove.bind(liquity, originalDeposit, trove, price),
        []
      ] as const);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex mt={4} justifyContent="center">
      <Button disabled mx={2}>
        <Loader mr={2} color="white" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex mt={4} justifyContent="center">
      <Transaction id={myTransactionId} {...{ send, requires }}>
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
  quiBalance: Decimal;
};

export const StabilityDepositManager: React.FC<StabilityDepositManagerProps> = ({
  liquity,
  deposit,
  trove,
  price,
  quiBalance
}) => {
  const [originalDeposit, setOriginalDeposit] = useState(deposit);
  const [editedDeposit, setEditedDeposit] = useState(deposit);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setOriginalDeposit(deposit);

    if (changePending && !deposit.deposit.eq(originalDeposit.deposit)) {
      setEditedDeposit(deposit);
      setChangePending(false);
    } else {
      if (!originalDeposit.isEmpty && editedDeposit.isEmpty) {
        return;
      }

      const difference = originalDeposit.calculateDifference(editedDeposit);

      if (difference) {
        setEditedDeposit(deposit.apply(difference)!);
      } else {
        setEditedDeposit(deposit);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          price,
          quiBalance
        }}
      />
    </>
  );
};
