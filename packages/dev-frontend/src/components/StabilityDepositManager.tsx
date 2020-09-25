import React, { useState, useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { Decimal } from "@liquity/decimal";
import { StabilityDeposit, Trove } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";
import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { Transaction, useMyTransactionState } from "./Transaction";

type StabilityDepositActionProps = {
  liquity: EthersLiquity;
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  trove: Trove;
  price: Decimal;
  quiBalance: Decimal;
  numberOfTroves: number;
};

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  liquity,
  originalDeposit,
  editedDeposit,
  changePending,
  setChangePending,
  trove,
  price,
  quiBalance,
  numberOfTroves
}) => {
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

  if (!difference && originalDeposit.pendingCollateralGain.isZero) {
    return null;
  }

  const actions = [
    ...(difference
      ? difference.positive
        ? ([
            [
              `Deposit ${difference.absoluteValue!.prettify()} LQTY${
                originalDeposit.pendingCollateralGain.nonZero
                  ? ` & withdraw ${originalDeposit.pendingCollateralGain.prettify(4)} ETH`
                  : ""
              }`,
              liquity.depositQuiInStabilityPool.bind(liquity, difference.absoluteValue!),
              [[quiBalance.gte(difference.absoluteValue!), "You don't have enough LQTY"]]
            ]
          ] as const)
        : ([
            [
              `Withdraw ${difference.absoluteValue!.prettify()} LQTY${
                originalDeposit.pendingCollateralGain.nonZero
                  ? ` & ${originalDeposit.pendingCollateralGain.prettify(4)} ETH`
                  : ""
              }`,
              liquity.withdrawQuiFromStabilityPool.bind(liquity, difference.absoluteValue!),
              []
            ]
          ] as const)
      : ([
          [
            `Withdraw ${originalDeposit.pendingCollateralGain.prettify(4)} ETH`,
            liquity.withdrawQuiFromStabilityPool.bind(liquity, 0),
            []
          ],
          ...(!trove.isEmpty
            ? ([
                [
                  `Transfer ${originalDeposit.pendingCollateralGain.prettify(4)} ETH to Trove`,
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

type StabilityDepositManagerProps = {
  liquity: EthersLiquity;
  deposit: StabilityDeposit;
  trove: Trove;
  price: Decimal;
  quiBalance: Decimal;
  numberOfTroves: number;
};

export const StabilityDepositManager: React.FC<StabilityDepositManagerProps> = ({
  liquity,
  deposit,
  trove,
  price,
  quiBalance,
  numberOfTroves
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
        {...{
          liquity,
          originalDeposit,
          editedDeposit,
          changePending,
          setChangePending,
          trove,
          price,
          quiBalance,
          numberOfTroves
        }}
      />
    </>
  );
};
