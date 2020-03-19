import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";
import { ContractTransaction } from "ethers";

import { Trove, Liquity, Pool } from "@liquity/lib";
import { Decimal, Difference } from "@liquity/lib/dist/utils";
import { useToast } from "../hooks/ToastProvider";
import { TroveEditor } from "./TroveEditor";

type TroveAction = [
  string,
  (liquity: Liquity, trove: Trove, price: Decimal) => Promise<ContractTransaction>
];

const getTroveAction = (property: "collateral" | "debt", difference: Difference): TroveAction => {
  switch (property) {
    case "collateral":
      if (difference.positive) {
        return [
          `Deposit ${difference.absoluteValue!.prettify()} ETH`,
          (liquity: Liquity, trove: Trove, price: Decimal) => {
            return liquity.depositEther(trove, difference.absoluteValue!, price);
          }
        ];
      } else {
        return [
          `Withdraw ${difference.absoluteValue!.prettify()} ETH`,
          (liquity: Liquity, trove: Trove, price: Decimal) => {
            return liquity.withdrawEther(trove, difference.absoluteValue!, price);
          }
        ];
      }
    case "debt":
      if (difference.positive) {
        return [
          `Borrow ${difference.absoluteValue!.prettify()} QUI`,
          (liquity: Liquity, trove: Trove, price: Decimal) => {
            return liquity.borrowQui(trove, difference.absoluteValue!, price);
          }
        ];
      } else {
        return [
          `Repay ${difference.absoluteValue!.prettify()} QUI`,
          (liquity: Liquity, trove: Trove, price: Decimal) => {
            return liquity.repayQui(trove, difference.absoluteValue!, price);
          }
        ];
      }
  }
};

const getNewTroveAction = (): TroveAction => {
  return [
    `Open new Trove`,
    (liquity: Liquity, trove: Trove, price: Decimal) => {
      return trove.debt.nonZero
        ? liquity.createTrove(trove, price)
        : liquity.depositEther(new Trove(), trove.collateral, price);
    }
  ];
};

type TroveActionProps = {
  liquity: Liquity;
  originalTrove?: Trove;
  editedTrove: Trove;
  setEditedTrove: (trove: Trove) => void;
  price: Decimal;
  pool: Pool;
};

const TroveAction: React.FC<TroveActionProps> = ({
  liquity,
  originalTrove,
  editedTrove,
  setEditedTrove,
  price,
  pool
}) => {
  const [actionState, setActionState] = useState<"idle" | "waitingForUser" | "waitingForNetwork">(
    "idle"
  );
  const change = (originalTrove || new Trove()).whatChanged(editedTrove);
  const { addMessage } = useToast();

  useEffect(() => {
    setActionState("idle");
  }, [originalTrove]);

  if (!change) {
    return null;
  }

  const [actionName, action] = !originalTrove
    ? getNewTroveAction()
    : getTroveAction(change.property, change.difference);

  return (
    <Flex mt={4} justifyContent="center">
      {actionState === "idle" ? (
        <>
          <Button
            mx={2}
            disabled={
              editedTrove.isBelowMinimumCollateralRatioAt(price) ||
              (pool.isRecoveryModeActiveAt(price) &&
                ((!originalTrove && editedTrove.debt.nonZero) ||
                  (originalTrove &&
                    editedTrove
                      .collateralRatioAfterRewardsAt(price)
                      .lt(originalTrove.collateralRatioAfterRewardsAt(price)))))
            }
            onClick={() => {
              setActionState("waitingForUser");
              action(liquity, originalTrove || editedTrove, price)
                .then(() => {
                  setActionState("waitingForNetwork");
                })
                .catch(() => {
                  setActionState("idle");
                  addMessage("Transaction failed", {
                    variant: "failure"
                  });
                });
            }}
          >
            {actionName}
          </Button>
          <Button
            mx={2}
            variant="danger"
            icon="Replay"
            icononly
            onClick={() => setEditedTrove(originalTrove || new Trove())}
          />
        </>
      ) : (
        <Button mx={2} disabled>
          <Loader mr={2} color="white" />
          {actionState === "waitingForUser"
            ? "Waiting for your confirmation"
            : "Transaction in progress"}
        </Button>
      )}
    </Flex>
  );
};

type TroveManagerProps = {
  liquity: Liquity;
  trove?: Trove;
  price: Decimal;
  pool: Pool;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ liquity, trove, price, pool }) => {
  const newTrove = !trove;
  const originalTrove = trove;
  const [editedTrove, setEditedTrove] = useState(originalTrove || new Trove());

  useEffect(() => setEditedTrove(originalTrove || new Trove()), [originalTrove]);

  return (
    <>
      <Box mt={4}>
        <TroveEditor
          title={newTrove ? "Open a new Liquity Trove" : "Your Liquity Trove"}
          {...{ originalTrove, editedTrove, setEditedTrove, price }}
        />
      </Box>

      <TroveAction {...{ liquity, originalTrove, editedTrove, setEditedTrove, price, pool }} />
    </>
  );
};
