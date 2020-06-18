import React, { useState, useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { Decimal, Percent } from "@liquity/decimal";
import { Trove, Liquity } from "@liquity/lib";
import { usePrevious } from "../hooks/usePrevious";
import { TroveEditor } from "./TroveEditor";
import { Transaction, useMyTransactionState } from "./Transaction";

type TroveActionProps = {
  liquity: Liquity;
  original: Trove;
  edited: Trove;
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
  original,
  edited,
  changePending,
  setChangePending,
  price,
  total,
  quiBalance
}) => {
  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const { collateralDifference, debtDifference } = original.whatChanged(edited);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending]);

  if (!collateralDifference && !debtDifference) {
    return null;
  }

  const [actionName, send, extraRequirements] = original.isEmpty
    ? edited.debt.nonZero
      ? ([
          "Open new Trove",
          liquity.openTrove.bind(liquity, edited, price),
          [
            [!total.collateralRatioIsBelowCritical(price), "Can't borrow LQTY during recovery mode"],
            [
              !total.add(edited).collateralRatioIsBelowCritical(price),
              `Total collateral ratio would fall below ${ccrPercent}`
            ]
          ]
        ] as const)
      : ([
          "Open new Trove",
          liquity.depositEther.bind(liquity, original, edited.collateral, price),
          []
        ] as const)
    : edited.isEmpty
    ? ([
        "Close Trove",
        liquity.closeTrove.bind(liquity),
        [
          [!total.collateralRatioIsBelowCritical(price), "Can't close Trove during recovery mode"],
          [quiBalance.gte(original.debt), "You don't have enough LQTY"]
        ]
      ] as const)
    : ([
        collateralDifference && debtDifference
          ? collateralDifference.positive && debtDifference.positive
            ? `Deposit ${collateralDifference.absoluteValue!.prettify()} ETH & ` +
              `borrow ${debtDifference.absoluteValue!.prettify()} LQTY`
            : collateralDifference.negative && debtDifference.negative
            ? `Repay ${debtDifference.absoluteValue!.prettify()} LQTY & ` +
              `withdraw ${collateralDifference.absoluteValue!.prettify()} ETH`
            : collateralDifference.positive
            ? `Deposit ${collateralDifference.absoluteValue!.prettify()} ETH & ` +
              `repay ${debtDifference.absoluteValue!.prettify()} LQTY`
            : `Borrow ${debtDifference.absoluteValue!.prettify()} LQTY & ` +
              `withdraw ${collateralDifference.absoluteValue!.prettify()} ETH`
          : collateralDifference
          ? `${collateralDifference.positive ? "Deposit" : "Withdraw"} ` +
            `${collateralDifference.absoluteValue!.prettify()} ETH`
          : `${debtDifference!.positive ? "Borrow" : "Repay"} ` +
            `${debtDifference!.absoluteValue!.prettify()} LQTY`,

        collateralDifference && debtDifference
          ? liquity.changeTrove.bind(
              liquity,
              original,
              { collateralDifference, debtDifference },
              price
            )
          : (collateralDifference
              ? collateralDifference.positive
                ? liquity.depositEther
                : liquity.withdrawEther
              : debtDifference!.positive
              ? liquity.borrowQui
              : liquity.repayQui
            ).bind(
              liquity,
              original,
              (collateralDifference || debtDifference)!.absoluteValue!,
              price
            ),
        [
          ...(collateralDifference?.negative
            ? ([
                [
                  !total.collateralRatioIsBelowCritical(price),
                  "Can't withdraw ETH during recovery mode"
                ]
              ] as const)
            : []),
          ...(debtDifference?.positive
            ? ([
                [
                  !total.collateralRatioIsBelowCritical(price),
                  "Can't borrow LQTY during recovery mode"
                ],
                [
                  !total.subtract(original).add(edited).collateralRatioIsBelowCritical(price),
                  `Total collateral ratio would fall below ${ccrPercent}`
                ]
              ] as const)
            : []),
          ...(debtDifference?.negative
            ? ([
                [quiBalance.gte(debtDifference.absoluteValue!), "You don't have enough LQTY"]
              ] as const)
            : [])
        ]
      ] as const);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex sx={{ mt: 4, justifyContent: "center" }}>
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex sx={{ mt: 4, justifyContent: "center" }}>
      <Transaction
        id={myTransactionId}
        requires={[
          [
            !edited.collateralRatioIsBelowMinimum(price),
            `Collateral ratio must be at least ${mcrPercent}`
          ],
          [
            edited.collateral.isZero || edited.collateral.mul(price).gte(20),
            "Collateral must be worth at least $20"
          ],
          ...extraRequirements
        ]}
        {...{ send }}
      >
        <Button sx={{ mx: 2 }}>{actionName}</Button>
      </Transaction>
    </Flex>
  );
};

type TroveManagerProps = {
  liquity: Liquity;
  troveWithoutRewards: Trove;
  trove: Trove;
  price: Decimal;
  total: Trove;
  quiBalance: Decimal;
};

export const TroveManager: React.FC<TroveManagerProps> = ({
  liquity,
  troveWithoutRewards,
  trove,
  price,
  total,
  quiBalance
}) => {
  const previousTroveWithoutRewards = usePrevious(troveWithoutRewards);
  const [original, setOriginal] = useState(trove);
  const [edited, setEdited] = useState(trove);
  const [changePending, setChangePending] = useState(false);

  useEffect(() => {
    setOriginal(trove);

    if (changePending && !troveWithoutRewards.equals(previousTroveWithoutRewards)) {
      setEdited(trove);
      setChangePending(false);
    } else {
      if (original.isEmpty !== edited.isEmpty) {
        return;
      }

      const change = original.whatChanged(edited);
      setEdited(trove.apply(change));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [troveWithoutRewards, trove]);

  return (
    <>
      <TroveEditor
        title={original.isEmpty ? "Open a new Liquity Trove" : "Your Liquity Trove"}
        {...{
          original,
          edited,
          setEdited,
          changePending,
          price
        }}
      />

      <TroveAction
        {...{
          liquity,
          original,
          edited,
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
