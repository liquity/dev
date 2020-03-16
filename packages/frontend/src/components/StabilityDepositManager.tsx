import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader } from "rimble-ui";
import { ContractTransaction } from "ethers";

import { Liquity, StabilityDeposit, Trove } from "@liquity/lib";
import { Difference, Decimal } from "@liquity/lib/dist/utils";
import { useToast } from "../hooks/ToastProvider";
import { StabilityDepositEditor } from "./StabilityDepositEditor";

const getStabilityDepositAction = (
  difference: Difference
): [string, (liquity: Liquity) => Promise<ContractTransaction>] => {
  if (difference.positive) {
    return [
      `Deposit ${difference.absoluteValue!.prettify()} QUI`,
      (liquity: Liquity) => {
        return liquity.depositQuiInStabilityPool(difference.absoluteValue!);
      }
    ];
  } else {
    return [
      `Withdraw ${difference.absoluteValue!.prettify()} QUI`,
      (liquity: Liquity) => {
        return liquity.withdrawQuiFromStabilityPool(difference.absoluteValue!);
      }
    ];
  }
};

type StabilityDepositActionProps = {
  liquity: Liquity;
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  setEditedDeposit: (deposit: StabilityDeposit) => void;
  trove?: Trove;
  price: Decimal;
};

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  liquity,
  originalDeposit,
  editedDeposit,
  setEditedDeposit,
  trove,
  price
}) => {
  const [actionState, setActionState] = useState<"idle" | "waitingForUser" | "waitingForNetwork">(
    "idle"
  );
  const difference = originalDeposit.calculateDifference(editedDeposit);
  const { addMessage } = useToast();

  useEffect(() => {
    setActionState("idle");
  }, [originalDeposit]);

  if (!difference && (originalDeposit.pendingCollateralGain.isZero || !trove)) {
    return null;
  }

  const [actionName, action] = (difference && getStabilityDepositAction(difference)) || [
    `Transfer ${originalDeposit.pendingCollateralGain.prettify(4)} ETH to Trove`,
    (liquity: Liquity) => {
      return liquity.transferCollateralGainToTrove(originalDeposit, trove!, price);
    }
  ];

  return (
    <Flex mt={4} justifyContent="center">
      {actionState === "idle" ? (
        <>
          <Button
            mx={2}
            disabled={false} // TODO
            onClick={() => {
              setActionState("waitingForUser");
              action(liquity)
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
          {difference && (
            <Button
              mx={2}
              variant="danger"
              icon="Replay"
              icononly
              onClick={() => setEditedDeposit(originalDeposit)}
            />
          )}
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

type StabilityDepositManagerProps = {
  liquity: Liquity;
  deposit: StabilityDeposit;
  trove?: Trove;
  price: Decimal;
};

export const StabilityDepositManager: React.FC<StabilityDepositManagerProps> = ({
  liquity,
  deposit,
  trove,
  price
}) => {
  const [editedDeposit, setEditedDeposit] = useState(deposit);

  useEffect(() => setEditedDeposit(deposit), [deposit]);

  return (
    <>
      <Box mt={4}>
        <StabilityDepositEditor
          title={deposit.isEmpty ? "Make a Stability Deposit" : "Your Stability Deposit"}
          {...{ originalDeposit: deposit, editedDeposit, setEditedDeposit }}
        />
      </Box>

      <StabilityDepositAction
        {...{ liquity, originalDeposit: deposit, editedDeposit, setEditedDeposit, trove, price }}
      />
    </>
  );
};
