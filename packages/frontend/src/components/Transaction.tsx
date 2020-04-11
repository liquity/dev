import React, { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { Flex, Text, Box, Tooltip } from "rimble-ui";
import { TransactionResponse } from "ethers/providers";

import { buildStyles, CircularProgressbarWithChildren } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import {
  LiquityTransactionOverrides,
  parseLogs,
  logDescriptionToString,
  contractsToInterfaces
} from "@liquity/lib";
import { useLiquity } from "../hooks/Liquity";

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

type TransactionFailed = {
  type: "failed";
  id: string;
  error: unknown;
};

type TransactionWaitingForApproval = {
  type: "waitingForApproval";
  id: string;
};

type TransactionCancelled = {
  type: "cancelled";
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
  type: "confirmed";
  id: string;
  numberOfConfirmationsToWait: number;
};

type TransactionState =
  | TransactionIdle
  | TransactionFailed
  | TransactionWaitingForApproval
  | TransactionCancelled
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

const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof (error as { message: unknown }).message === "string";

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
  tooltipPlacement?: string;
  requires?: readonly (readonly [boolean, string])[];
  send: TransactionFunction;
  numberOfConfirmationsToWait?: number;
  children: C;
};

export function Transaction<C extends React.ReactElement<ButtonlikeProps>>({
  id,
  tooltip,
  tooltipPlacement,
  requires,
  send,
  numberOfConfirmationsToWait = 3,
  children
}: TransactionProps<C>) {
  const [transactionState, setTransactionState] = useTransactionState();
  const { devChain } = useLiquity();
  const trigger = React.Children.only<C>(children);

  numberOfConfirmationsToWait = devChain ? 1 : numberOfConfirmationsToWait;

  const sendTransaction = useCallback(async () => {
    setTransactionState({ type: "waitingForApproval", id });

    try {
      const { hash } = await send({
        // TODO get a safe gas price from ethgasstation
        // Note that this only applies to mainnet though, which we don't support yet
        gasPrice: 2000000000
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

      if (hasMessage(error) && error.message.includes("User denied transaction signature")) {
        setTransactionState({ type: "cancelled", id });
      } else {
        setTransactionState({ type: "failed", id, error });
      }
    }
  }, [send, id, setTransactionState, numberOfConfirmationsToWait]);

  const failureReasons = (requires || [])
    .filter(([requirement]) => !requirement)
    .map(([, reason]) => reason);

  if (
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmations"
  ) {
    failureReasons.push("You must wait for confirmation");
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
    <Tooltip message={tooltip} variant="light" placement={tooltipPlacement || "right"}>
      <Box opacity={showFailure ? 0.5 : 1}>{clonedTrigger}</Box>
    </Tooltip>
  ) : (
    clonedTrigger
  );
}

export const TransactionMonitor: React.FC = () => {
  const { provider, contracts, account } = useLiquity();
  const [transactionState, setTransactionState] = useTransactionState();
  const interfaces = useMemo(() => contractsToInterfaces(contracts), [contracts]);

  const id = transactionState.type !== "idle" ? transactionState.id : undefined;

  const hash =
    transactionState.type === "waitingForConfirmations" ? transactionState.hash : undefined;

  const numberOfConfirmationsToWait =
    transactionState.type === "waitingForConfirmations" || transactionState.type === "confirmed"
      ? transactionState.numberOfConfirmationsToWait
      : undefined;

  const confirmations =
    transactionState.type === "waitingForConfirmations"
      ? transactionState.confirmations
      : transactionState.type === "confirmed"
      ? numberOfConfirmationsToWait
      : undefined;

  useEffect(() => {
    if (id && hash && numberOfConfirmationsToWait) {
      let didParseLogs = false;
      let confirmations = 0;
      let seenBlock = 0;

      const blockListener = async (blockNumber: number) => {
        if (blockNumber <= seenBlock) {
          // Sometimes, when blocks are produced quickly, we get a burst of block events from
          // ethers.js. They come in reverse order for some reason. In any case, there's no need
          // to rerun the listener for stale events as we're always fetching the latest data.
          return;
        }
        seenBlock = blockNumber;

        const transactionReceipt = await provider.getTransactionReceipt(hash);
        if (!transactionReceipt) {
          console.log(`Block #${blockNumber} doesn't include tx ${hash}`);
          return;
        }

        if (
          transactionReceipt.blockNumber &&
          transactionReceipt.confirmations &&
          transactionReceipt.confirmations > confirmations
        ) {
          // The block that mines the transaction is the 1st confirmation
          const blockNumber = transactionReceipt.blockNumber + transactionReceipt.confirmations - 1;
          confirmations = transactionReceipt.confirmations;

          console.log(`Block #${blockNumber} ${confirmations}-confirms tx ${hash}`);
        }

        if (transactionReceipt.logs && !didParseLogs) {
          const [parsedLogs, unparsedLogs] = parseLogs(transactionReceipt.logs, interfaces);

          console.log(`Logs of tx ${hash}:`);
          parsedLogs.forEach(([contractName, logDescription]) =>
            console.log(
              `  ${contractName}.${logDescriptionToString(logDescription, {
                [account]: ["user"],
                ...interfaces
              })}`
            )
          );

          if (unparsedLogs.length > 0) {
            console.warn("Warning: not all logs were parsed. Unparsed logs:");
            console.warn(unparsedLogs);
          }

          didParseLogs = true;
        }

        if (transactionReceipt.confirmations) {
          if (transactionReceipt.confirmations >= numberOfConfirmationsToWait) {
            setTransactionState({
              type: "confirmed",
              id,
              numberOfConfirmationsToWait
            });
          } else {
            setTransactionState({
              type: "waitingForConfirmations",
              id,
              hash,
              numberOfConfirmationsToWait,
              confirmations: transactionReceipt.confirmations
            });
          }
        }
      };

      console.log(`Start monitoring tx ${hash}`);
      provider.on("block", blockListener);

      return () => {
        console.log(`Finish monitoring tx ${hash}`);
        provider.removeListener("block", blockListener);
      };
    }
  }, [provider, account, interfaces, id, hash, numberOfConfirmationsToWait, setTransactionState]);

  useEffect(() => {
    if (
      transactionState.type === "confirmed" ||
      transactionState.type === "failed" ||
      transactionState.type === "cancelled"
    ) {
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

  return (
    <Flex
      alignItems="center"
      bg={
        transactionState.type === "confirmed"
          ? "success"
          : transactionState.type === "cancelled"
          ? "warning"
          : transactionState.type === "failed"
          ? "danger"
          : "primary"
      }
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
          value={confirmations || 0}
          maxValue={numberOfConfirmationsToWait || 1}
          {...circularProgressbarStyle}
        >
          <Text fontSize={1} fontWeight={3} color="white">
            {transactionState.type === "failed" || transactionState.type === "cancelled"
              ? "✖"
              : `${confirmations}/${numberOfConfirmationsToWait}`}
          </Text>
        </CircularProgressbarWithChildren>
      </Box>
      <Text fontSize={3} color="white">
        {transactionState.type === "waitingForConfirmations"
          ? "Waiting for confirmation"
          : transactionState.type === "cancelled"
          ? "Cancelled"
          : transactionState.type === "failed"
          ? "Failed"
          : "Confirmed"}
      </Text>
    </Flex>
  );
};
