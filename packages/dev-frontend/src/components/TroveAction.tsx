import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { Decimal, Percent } from "@liquity/decimal";
import {
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  LUSD_LIQUIDATION_RESERVE,
  LiquityStoreState,
  Trove,
  TroveAdjustmentParams,
  TroveChange
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";

import { Transaction, useMyTransactionState } from "./Transaction";

type TroveActionProps = {
  original: Trove;
  edited: Trove;
  afterFee: Trove;
  change?: TroveChange<Decimal>;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

const describeAdjustment = ({
  depositCollateral,
  withdrawCollateral,
  borrowLUSD,
  repayLUSD
}: TroveAdjustmentParams<Decimal>) =>
  depositCollateral && borrowLUSD
    ? `Deposit ${depositCollateral.prettify()} ETH & borrow ${borrowLUSD.prettify()} ${COIN}`
    : repayLUSD && withdrawCollateral
    ? `Repay ${repayLUSD.prettify()} ${COIN} & withdraw ${withdrawCollateral.prettify()} ETH`
    : depositCollateral && repayLUSD
    ? `Deposit ${depositCollateral.prettify()} ETH & repay ${repayLUSD.prettify()} ${COIN}`
    : borrowLUSD && withdrawCollateral
    ? `Borrow ${borrowLUSD.prettify()} ${COIN} & withdraw ${withdrawCollateral.prettify()} ETH`
    : depositCollateral
    ? `Deposit ${depositCollateral.prettify()} ETH`
    : withdrawCollateral
    ? `Withdraw ${withdrawCollateral.prettify()} ETH`
    : borrowLUSD
    ? `Borrow ${borrowLUSD.prettify()} ${COIN}`
    : repayLUSD
    ? `Repay ${repayLUSD.prettify()} ${COIN}`
    : "";

const select = ({ price, total, lusdBalance, numberOfTroves, fees }: LiquityStoreState) => ({
  price,
  total,
  lusdBalance,
  numberOfTroves,
  fees
});

export const TroveAction: React.FC<TroveActionProps> = ({
  original,
  edited,
  afterFee,
  change,
  changePending,
  dispatch
}) => {
  const { numberOfTroves, price, lusdBalance, total, fees } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    }
  }, [myTransactionState.type, dispatch]);

  if (!change) {
    return null;
  }

  if (change.type === "invalidCreation") {
    // Yuck, Transaction needs refactoring
    return (
      <Flex variant="layout.actions">
        <Transaction
          id={myTransactionId}
          requires={[
            [false, `Need at least ${LUSD_LIQUIDATION_RESERVE} ${COIN} for gas compensation`]
          ]}
          send={(() => {}) as any}
        >
          <Button sx={{ mx: 2 }} />
        </Transaction>
      </Flex>
    );
  }

  const [actionName, send, extraRequirements] =
    change.type === "creation"
      ? ([
          describeAdjustment(change.params),
          liquity.openTrove.bind(liquity, change.params, { numberOfTroves, fees }),
          [
            [
              afterFee.isOpenableInRecoveryMode(price) ||
                !total.collateralRatioIsBelowCritical(price),
              `Can't open Trove with less than ${ccrPercent} collateral ratio during recovery mode`
            ]
          ]
        ] as const)
      : change.type === "closure"
      ? ([
          "Close Trove",
          liquity.closeTrove.bind(liquity),
          [
            [!total.collateralRatioIsBelowCritical(price), "Can't close Trove during recovery mode"],
            [numberOfTroves > 1, "Can't close when no other Trove exists"]
          ]
        ] as const)
      : ([
          describeAdjustment(change.params),

          liquity.adjustTrove.bind(liquity, change.params, {
            numberOfTroves,
            trove: original,
            fees
          }),

          [
            [
              !change.params.withdrawCollateral || !total.collateralRatioIsBelowCritical(price),
              "Can't withdraw ETH during recovery mode"
            ],
            [
              !change.params.borrowLUSD || !total.collateralRatioIsBelowCritical(price),
              `Can't borrow ${COIN} during recovery mode`
            ]
          ]
        ] as const);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        requires={[
          [
            edited.isEmpty || edited.debt.gte(LUSD_LIQUIDATION_RESERVE),
            `Need at least ${LUSD_LIQUIDATION_RESERVE} ${COIN} for gas compensation`
          ],
          [
            !(
              change.type === "creation" ||
              (change.type === "adjustment" &&
                (change.params.withdrawCollateral || change.params.borrowLUSD))
            ) || !afterFee.collateralRatioIsBelowMinimum(price),
            `Collateral ratio must be at least ${mcrPercent}`
          ],
          [
            !(
              change.type === "creation" ||
              (change.type === "adjustment" && change.params.borrowLUSD)
            ) || !total.subtract(original).add(afterFee).collateralRatioIsBelowCritical(price),
            `Total collateral ratio would fall below ${ccrPercent}`
          ],
          [lusdBalance.gte(change.params.repayLUSD ?? 0), `You don't have enough ${COIN}`],
          ...extraRequirements
        ]}
        {...{ send }}
      >
        <Button sx={{ mx: 2 }}>{actionName}</Button>
      </Transaction>
    </Flex>
  );
};
