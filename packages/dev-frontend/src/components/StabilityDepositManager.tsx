import React, { useState, useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { StabilityDeposit, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { Transaction, useMyTransactionState } from "./Transaction";
import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";

type StabilityDepositActionProps = {
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
};

const select = ({ trove, price, lusdBalance, numberOfTroves }: LiquityStoreState) => ({
  trove,
  price,
  lusdBalance,
  numberOfTroves
});

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  originalDeposit,
  editedDeposit,
  changePending,
  setChangePending
}) => {
  const { trove, price, lusdBalance, numberOfTroves } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(/^stability-deposit-/);
  const difference = originalDeposit.calculateDifference(editedDeposit);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!difference && originalDeposit.collateralGain.isZero) {
    return null;
  }

  const actions = [
    ...(difference
      ? difference.positive
        ? ([
            [
              `Deposit ${difference.absoluteValue!.prettify()} ${COIN}${
                originalDeposit.collateralGain.nonZero
                  ? ` & withdraw ${originalDeposit.collateralGain.prettify(4)} ETH`
                  : ""
              }`,
              liquity.depositLUSDInStabilityPool.bind(liquity, difference.absoluteValue!, undefined),
              [[lusdBalance.gte(difference.absoluteValue!), `You don't have enough ${COIN}`]]
            ]
          ] as const)
        : ([
            [
              `Withdraw ${difference.absoluteValue!.prettify()} ${COIN}${
                originalDeposit.collateralGain.nonZero
                  ? ` & ${originalDeposit.collateralGain.prettify(4)} ETH`
                  : ""
              }`,
              liquity.withdrawLUSDFromStabilityPool.bind(liquity, difference.absoluteValue!),
              []
            ]
          ] as const)
      : ([
          [
            `Withdraw ${originalDeposit.collateralGain.prettify(4)} ETH`,
            liquity.withdrawLUSDFromStabilityPool.bind(liquity, 0),
            []
          ],
          ...(!trove.isEmpty
            ? ([
                [
                  `Transfer ${originalDeposit.collateralGain.prettify(4)} ETH to Trove`,
                  liquity.transferCollateralGainToTrove.bind(liquity, {
                    deposit: originalDeposit,
                    trove,
                    price,
                    numberOfTroves
                  }),
                  []
                ]
              ] as const)
            : [])
        ] as const))
  ];

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex sx={{ mt: [0, 0, 3], flexWrap: "wrap", justifyContent: "center" }}>
      {actions.map(([actionName], i) => (
        <Button key={i} disabled sx={{ mt: 3, mx: 2 }}>
          {myTransactionState.id === `${myTransactionId}-${i}` ? (
            <>
              <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
              Waiting for your approval
            </>
          ) : (
            actionName
          )}
        </Button>
      ))}
    </Flex>
  ) : changePending ? null : (
    <Flex sx={{ mt: [0, null, 3], flexWrap: "wrap", justifyContent: "center" }}>
      {actions.map(([actionName, send, requires], i) => (
        <Transaction key={i} id={`${myTransactionId}-${i}`} {...{ send, requires }}>
          <Button sx={{ mt: 3, mx: 2 }}>{actionName}</Button>
        </Transaction>
      ))}
    </Flex>
  );
};

const selectDeposit = ({ deposit }: LiquityStoreState) => deposit;

export const StabilityDepositManager: React.FC = () => {
  const deposit = useLiquitySelector(selectDeposit);
  const [originalDeposit, setOriginalDeposit] = useState(deposit);
  const [editedDeposit, setEditedDeposit] = useState(deposit);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setOriginalDeposit(deposit);

    if (changePending && !deposit.initial.eq(originalDeposit.initial)) {
      setEditedDeposit(deposit);
      setChangePending(false);
    } else {
      if (!originalDeposit.isEmpty && editedDeposit.isEmpty) {
        return;
      }

      const difference = originalDeposit.calculateDifference(editedDeposit);
      setEditedDeposit(deposit.apply(difference));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposit]);

  return (
    <>
      <StabilityDepositEditor
        title={deposit.isEmpty ? "Make a Stability Deposit" : "My Stability Deposit"}
        {...{ originalDeposit, editedDeposit, setEditedDeposit, changePending }}
      />

      <StabilityDepositAction
        {...{ originalDeposit, editedDeposit, changePending, setChangePending }}
      />
    </>
  );
};
