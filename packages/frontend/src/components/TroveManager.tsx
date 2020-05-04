import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";
import { TroveEditor } from "./TroveEditor";
import { Transaction, useMyTransactionState } from "./Transaction";

type TroveActionProps = {
  liquity: Liquity;
  originalTrove: Trove;
  editedTrove: Trove;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  price: Decimal;
  total: Trove;
  quiBalance: Decimal;
};

const mcrPercent = new Percent(Liquity.MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(Liquity.CRITICAL_COLLATERAL_RATIO).toString(0);

const TroveAction: React.FC<TroveActionProps> = ({
  liquity,
  originalTrove,
  editedTrove,
  changePending,
  setChangePending,
  price,
  total,
  quiBalance
}) => {
  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const change = originalTrove.whatChanged(editedTrove);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!change) {
    return null;
  }

  const [actionName, send, extraRequirements] = originalTrove.isEmpty
    ? editedTrove.debt.nonZero
      ? ([
          "Open new Trove",
          liquity.openTrove.bind(liquity, editedTrove, price),
          [[!total.collateralRatioIsBelowCritical(price), "Can't borrow QUI during recovery mode"]]
        ] as const)
      : ([
          "Open new Trove",
          liquity.depositEther.bind(liquity, originalTrove, editedTrove.collateral, price),
          []
        ] as const)
    : editedTrove.isEmpty
    ? ([
        "Close Trove",
        liquity.closeTrove.bind(liquity),
        [
          [!total.collateralRatioIsBelowCritical(price), "Can't close Trove during recovery mode"],
          [quiBalance.gte(originalTrove.debtAfterReward), "You don't have enough QUI"]
        ]
      ] as const)
    : (([verb, unit, method, extraRequirements]) =>
        [
          `${verb} ${change.difference.absoluteValue!.prettify()} ${unit}`,
          method.bind(liquity, originalTrove, change.difference.absoluteValue!, price),
          extraRequirements
        ] as const)(
        ({
          collateral: [
            [
              "Withdraw",
              "ETH",
              liquity.withdrawEther,
              [
                [
                  !total.collateralRatioIsBelowCritical(price),
                  "Can't withdraw ETH during recovery mode"
                ]
              ]
            ],
            ["Deposit", "ETH", liquity.depositEther, []]
          ],
          debt: [
            [
              "Repay",
              "QUI",
              liquity.repayQui,
              [[quiBalance.gte(change.difference.absoluteValue!), "You don't have enough QUI"]]
            ],
            [
              "Borrow",
              "QUI",
              liquity.borrowQui,
              [
                [
                  !total.collateralRatioIsBelowCritical(price),
                  "Can't borrow QUI during recovery mode"
                ]
              ]
            ]
          ]
        } as const)[change.property][change.difference.positive ? 1 : 0]
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
          ...extraRequirements,
          [
            editedTrove.collateral.isZero || editedTrove.collateral.mul(price).gte(20),
            "Collateral must be worth at least $20"
          ],
          [
            !editedTrove.collateralRatioIsBelowMinimum(price),
            `Collateral ratio must be at least ${mcrPercent}`
          ],
          [
            !total.subtract(originalTrove).add(editedTrove).collateralRatioIsBelowCritical(price),
            `Total collateral ratio would fall below ${ccrPercent}`
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
  total: Trove;
  quiBalance: Decimal;
};

export const TroveManager: React.FC<TroveManagerProps> = ({
  liquity,
  trove,
  price,
  total,
  quiBalance
}) => {
  const [originalTrove, setOriginalTrove] = useState(trove);
  const [editedTrove, setEditedTrove] = useState(trove);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setOriginalTrove(trove);

    if (
      changePending &&
      (!trove.collateral.eq(originalTrove.collateral) || !trove.debt.eq(originalTrove.debt))
    ) {
      setEditedTrove(trove);
      setChangePending(false);
    } else {
      if (originalTrove.isEmpty !== editedTrove.isEmpty) {
        return;
      }

      const change = originalTrove.whatChanged(editedTrove);

      if (change) {
        setEditedTrove(trove.apply(change)!);
      } else {
        setEditedTrove(trove);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {...{
          liquity,
          originalTrove,
          editedTrove,
          changePending,
          setChangePending,
          price,
          total,
          quiBalance
        }}
      />
    </>
  );
};
