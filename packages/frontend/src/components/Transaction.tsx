import React, { useState, useContext, useEffect, useCallback } from "react";
import { Flex, Text, Box, Tooltip } from "rimble-ui";
import { TransactionResponse } from "ethers/providers";

import { buildStyles, CircularProgressbarWithChildren } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import { LiquityTransactionOverrides } from "@liquity/lib";
import { useLiquity } from "../hooks/Liquity";
import { useToast } from "../hooks/ToastProvider";

const circularProgressbarStyle = {
  strokeWidth: 10,
  styles: buildStyles({
    strokeLinecap: "butt",
    pathTransitionDuration: 0.5,
    pathColor: "white",
    trailColor: "rgba(255, 255, 255, 0.33)"
  })
};

type TransactionIdle = {
  type: "idle";
};

type TransactionWaitingForApproval = {
  type: "waitingForApproval";
  id: string;
};

type TransactionWaitingForConfirmations = {
  type: "waitingForConfirmations";
  id: string;
  hash: string;
  confirmations: number;
  numberOfConfirmationsToWait: number;
};

type TransactionConfirmed = {
  id: string;
  type: "confirmed";
  confirmations: number;
};

type TransactionState =
  | TransactionIdle
  | TransactionWaitingForApproval
  | TransactionWaitingForConfirmations
  | TransactionConfirmed;

const TransactionContext = React.createContext<
  [TransactionState, (state: TransactionState) => void] | undefined
>(undefined);

export const TransactionProvider: React.FC = ({ children }) => {
  const transactionState = useState<TransactionState>({ type: "idle" });
  return (
    <TransactionContext.Provider value={transactionState}>{children}</TransactionContext.Provider>
  );
};

const useTransactionState = () => {
  const transactionState = useContext(TransactionContext);

  if (!transactionState) {
    throw new Error("You must provide a TransactionContext via TransactionProvider");
  }

  return transactionState;
};

export const useMyTransactionState = (myId: string | RegExp): TransactionState => {
  const [transactionState] = useTransactionState();

  return transactionState.type !== "idle" &&
    (typeof myId === "string" ? transactionState.id === myId : transactionState.id.match(myId))
    ? transactionState
    : { type: "idle" };
};

type ButtonlikeProps = {
  variant?: "danger";
  onClick?: () => void;
};

export type TransactionFunction = (
  overrides?: LiquityTransactionOverrides
) => Promise<TransactionResponse>;

type TransactionProps<C> = {
  id: string;
  tooltip?: string;
  requires?: [boolean, string][];
  send: TransactionFunction;
  numberOfConfirmationsToWait?: number;
  children: C;
};

export function Transaction<C extends React.ReactElement<ButtonlikeProps>>({
  id,
  tooltip,
  requires,
  send,
  numberOfConfirmationsToWait = 3,
  children
}: TransactionProps<C>) {
  const { addMessage } = useToast();
  const [transactionState, setTransactionState] = useTransactionState();
  const trigger = React.Children.only<C>(children);

  const sendTransaction = useCallback(async () => {
    setTransactionState({ type: "waitingForApproval", id });

    try {
      const { hash } = await send({
        // TODO recommend a gasPrice
      });

      if (!hash) {
        throw new Error("No transaction hash?");
      }

      setTransactionState({
        type: "waitingForConfirmations",
        id,
        hash,
        confirmations: 0,
        numberOfConfirmationsToWait
      });
    } catch (error) {
      console.log(error);

      addMessage("Transaction failed", {
        variant: "failure"
      });

      setTransactionState({ type: "idle" });
    }
  }, [send, id, setTransactionState, addMessage, numberOfConfirmationsToWait]);

  const failureReasons = (requires || [])
    .filter(([requirement]) => !requirement)
    .map(([, reason]) => reason);

  if (transactionState.type !== "idle" && transactionState.type !== "confirmed") {
    failureReasons.push("You must wait for confirmation first");
  }

  const showFailure = failureReasons.length > 0 && (tooltip ? "asTooltip" : "asChildText");

  const clonedTrigger =
    showFailure === "asChildText"
      ? React.cloneElement(
          trigger,
          {
            variant: "danger",
            onClick: undefined
          },
          failureReasons[0]
        )
      : showFailure === "asTooltip"
      ? React.cloneElement(trigger, { variant: "danger", onClick: undefined })
      : React.cloneElement(trigger, { onClick: sendTransaction });

  if (showFailure === "asTooltip") {
    tooltip = failureReasons[0];
  }

  return tooltip ? (
    <Tooltip message={tooltip} variant="light" placement="right">
      <Box opacity={showFailure ? 0.5 : 1}>{clonedTrigger}</Box>
    </Tooltip>
  ) : (
    clonedTrigger
  );
}

export const TransactionMonitor: React.FC = () => {
  const { provider } = useLiquity();
  const [transactionState, setTransactionState] = useTransactionState();

  const monitoredTransaction =
    transactionState.type === "waitingForConfirmations"
      ? {
          id: transactionState.id,
          hash: transactionState.hash,
          numberOfConfirmationsToWait: transactionState.numberOfConfirmationsToWait
        }
      : undefined;

  useEffect(() => {
    if (monitoredTransaction) {
      const blockListener = async () => {
        const transactionReceipt = await provider.getTransactionReceipt(monitoredTransaction.hash);

        if (transactionReceipt?.confirmations) {
          if (transactionReceipt.confirmations >= monitoredTransaction.numberOfConfirmationsToWait) {
            setTransactionState({
              type: "confirmed",
              id: monitoredTransaction.id,
              confirmations: monitoredTransaction.numberOfConfirmationsToWait
            });
          } else {
            setTransactionState({
              type: "waitingForConfirmations",
              ...monitoredTransaction,
              confirmations: transactionReceipt.confirmations
            });
          }
        }
      };

      provider.on("block", blockListener);

      return () => {
        provider.removeListener("block", blockListener);
      };
    }
  }, [provider, monitoredTransaction, setTransactionState]);

  useEffect(() => {
    if (transactionState.type === "confirmed") {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setTransactionState({ type: "idle" });
        }
      }, 5000);

      return () => {
        cancelled = true;
      };
    }
  }, [transactionState.type, setTransactionState]);

  if (transactionState.type === "idle" || transactionState.type === "waitingForApproval") {
    return null;
  }

  const confirmations = transactionState.confirmations;
  const numberOfConfirmationsToWait =
    transactionState.type === "waitingForConfirmations"
      ? transactionState.numberOfConfirmationsToWait
      : transactionState.confirmations;

  return (
    <Flex
      alignItems="center"
      bg={transactionState.type === "confirmed" ? "success" : "primary"}
      p={3}
      pl={4}
      position="fixed"
      width="100vw"
      bottom={0}
      overflow="hidden"
      zIndex={2}
    >
      <Box width="40px" height="40px" mr={3}>
        <CircularProgressbarWithChildren
          value={confirmations}
          maxValue={numberOfConfirmationsToWait}
          {...circularProgressbarStyle}
        >
          <Text fontSize={1} fontWeight={3} color="white">
            {confirmations}/{numberOfConfirmationsToWait}
          </Text>
        </CircularProgressbarWithChildren>
      </Box>
      <Text fontSize={3} color="white">
        {transactionState.type === "waitingForConfirmations"
          ? `Waiting for confirmation`
          : "Confirmed"}
      </Text>
    </Flex>
  );
};
