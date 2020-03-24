import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";

import { Trove, Liquity, Pool } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";
import { TroveEditor } from "./TroveEditor";
import { Transaction, TransactionFunction, useMyTransactionState } from "./Transaction";

type TroveActionProps = {
  liquity: Liquity;
  originalTrove: Trove;
  editedTrove: Trove;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  price: Decimal;
  pool: Pool;
};

const mcrPercent = new Percent(Liquity.MINIMUM_COLLATERAL_RATIO).toString(0);

const TroveAction: React.FC<TroveActionProps> = ({
  liquity,
  originalTrove,
  editedTrove,
  changePending,
  setChangePending,
  price,
  pool
}) => {
  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const change = originalTrove.whatChanged(editedTrove);

  useEffect(() => {
    if (myTransactionState.type === "idle") {
      setChangePending(false);
    } else if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!change) {
    return null;
  }

  const [actionName, send]: [string, TransactionFunction] = originalTrove.isEmpty
    ? [
        `Open new Trove`,
        editedTrove.debt.nonZero
          ? liquity.createTrove.bind(liquity, editedTrove, price)
          : liquity.depositEther.bind(liquity, originalTrove, editedTrove.collateral, price)
      ]
    : (({ verb, unit, method }): [string, TransactionFunction] => [
        `${verb} ${change.difference.absoluteValue!.prettify()} ${unit}`,
        method.bind(liquity, originalTrove, change.difference.absoluteValue!, price)
      ])(
        {
          collateral: [
            { verb: "Withdraw", unit: "ETH", method: liquity.withdrawEther },
            { verb: "Deposit", unit: "ETH", method: liquity.depositEther }
          ],
          debt: [
            { verb: "Repay", unit: "QUI", method: liquity.repayQui },
            { verb: "Borrow", unit: "QUI", method: liquity.borrowQui }
          ]
        }[change.property][change.difference.positive ? 1 : 0]
      );

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex mt={4} justifyContent="center">
      <Button disabled mx={2}>
        <Loader mr={2} color="white" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex mt={4} justifyContent="center">
      <Transaction
        id={myTransactionId}
        requires={[
          [
            !editedTrove.isBelowMinimumCollateralRatioAt(price),
            `Collateral ratio must be at least ${mcrPercent}`
          ],
          [
            !pool.isRecoveryModeActiveAt(price) ||
              editedTrove.debt.lte(originalTrove.debtAfterReward),
            "Borrowing QUI is not allowed during recovery mode"
          ],
          [
            !pool.isRecoveryModeActiveAt(price) ||
              editedTrove.collateral.gte(originalTrove.collateralAfterReward),
            "Withdrawing ETH is not allowed during recovery mode"
          ]
        ]}
        {...{ send }}
      >
        <Button mx={2}>{actionName}</Button>
      </Transaction>
    </Flex>
  );
};

type TroveManagerProps = {
  liquity: Liquity;
  trove: Trove;
  price: Decimal;
  pool: Pool;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ liquity, trove, price, pool }) => {
  const originalTrove = trove;
  const [editedTrove, setEditedTrove] = useState(trove);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setEditedTrove(trove);
    setChangePending(false);
  }, [trove]);

  return (
    <>
      <Box mt={4}>
        <TroveEditor
          title={originalTrove.isEmpty ? "Open a new Liquity Trove" : "Your Liquity Trove"}
          {...{ originalTrove, editedTrove, setEditedTrove, changePending, price }}
        />
      </Box>

      <TroveAction
        {...{ liquity, originalTrove, editedTrove, changePending, setChangePending, price, pool }}
      />
    </>
  );
};
