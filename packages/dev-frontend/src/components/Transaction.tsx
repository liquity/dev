import React, { useState, useContext, useEffect, useCallback } from "react";
import { Flex, Text, Box } from "theme-ui";
import { Provider, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { hexDataSlice, hexDataLength } from "@ethersproject/bytes";
import { defaultAbiCoder } from "@ethersproject/abi";

import { buildStyles, CircularProgressbarWithChildren } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import { EthersTransactionOverrides, EthersTransactionCancelledError } from "@liquity/lib-ethers";
import { SentLiquityTransaction, LiquityReceipt } from "@liquity/lib-base";

import { useLiquity } from "../hooks/LiquityContext";

import { Icon } from "./Icon";
import { Tooltip, TooltipProps, Hoverable } from "./Tooltip";

const strokeWidth = 10;

const circularProgressbarStyle = {
  strokeLinecap: "butt",
  pathColor: "white",
  trailColor: "rgba(255, 255, 255, 0.33)"
};

const slowProgress = {
  strokeWidth,
  styles: buildStyles({
    ...circularProgressbarStyle,
    pathTransitionDuration: 30
  })
};

const fastProgress = {
  strokeWidth,
  styles: buildStyles({
    ...circularProgressbarStyle,
    pathTransitionDuration: 0.75
  })
};

type TransactionIdle = {
  type: "idle";
};

type TransactionFailed = {
  type: "failed";
  id: string;
  error: Error;
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
  type: "waitingForConfirmation";
  id: string;
  tx: SentTransaction;
};

type TransactionConfirmed = {
  type: "confirmed";
  id: string;
};

type TransactionConfirmedOneShot = {
  type: "confirmedOneShot";
  id: string;
};

type TransactionState =
  | TransactionIdle
  | TransactionFailed
  | TransactionWaitingForApproval
  | TransactionCancelled
  | TransactionWaitingForConfirmations
  | TransactionConfirmed
  | TransactionConfirmedOneShot;

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
  disabled?: boolean;
  variant?: string;
  onClick?: () => void;
};

type SentTransaction = SentLiquityTransaction<
  TransactionResponse,
  LiquityReceipt<TransactionReceipt>
>;

export type TransactionFunction = (
  overrides?: EthersTransactionOverrides
) => Promise<SentTransaction>;

type TransactionProps<C> = {
  id: string;
  tooltip?: string;
  tooltipPlacement?: TooltipProps<C>["placement"];
  showFailure?: "asTooltip" | "asChildText";
  requires?: readonly (readonly [boolean, string])[];
  send: TransactionFunction;
  children: C;
};

export const useTransactionFunction = (
  id: string,
  send: TransactionFunction
): [sendTransaction: () => Promise<void>, transactionState: TransactionState] => {
  const [transactionState, setTransactionState] = useTransactionState();

  const sendTransaction = useCallback(async () => {
    setTransactionState({ type: "waitingForApproval", id });

    try {
      const tx = await send();

      setTransactionState({
        type: "waitingForConfirmation",
        id,
        tx
      });
    } catch (error) {
      if (hasMessage(error) && error.message.includes("User denied transaction signature")) {
        setTransactionState({ type: "cancelled", id });
      } else {
        console.error(error);

        setTransactionState({
          type: "failed",
          id,
          error: new Error("Failed to send transaction (try again)")
        });
      }
    }
  }, [send, id, setTransactionState]);

  return [sendTransaction, transactionState];
};

export function Transaction<C extends React.ReactElement<ButtonlikeProps & Hoverable>>({
  id,
  tooltip,
  tooltipPlacement,
  showFailure,
  requires,
  send,
  children
}: TransactionProps<C>) {
  const [sendTransaction, transactionState] = useTransactionFunction(id, send);
  const trigger = React.Children.only<C>(children);

  const failureReasons = (requires || [])
    .filter(([requirement]) => !requirement)
    .map(([, reason]) => reason);

  if (
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation"
  ) {
    failureReasons.push("You must wait for confirmation");
  }

  showFailure =
    failureReasons.length > 0 ? showFailure ?? (tooltip ? "asTooltip" : "asChildText") : undefined;

  const clonedTrigger =
    showFailure === "asChildText"
      ? React.cloneElement(
          trigger,
          {
            disabled: true,
            variant: "danger"
          },
          failureReasons[0]
        )
      : showFailure === "asTooltip"
      ? React.cloneElement(trigger, { disabled: true })
      : React.cloneElement(trigger, { onClick: sendTransaction });

  if (showFailure === "asTooltip") {
    tooltip = failureReasons[0];
  }

  return tooltip ? (
    <>
      <Tooltip message={tooltip} placement={tooltipPlacement || "right"}>
        {clonedTrigger}
      </Tooltip>
    </>
  ) : (
    clonedTrigger
  );
}

// Doesn't work on Kovan:
// https://github.com/MetaMask/metamask-extension/issues/5579
const tryToGetRevertReason = async (provider: Provider, tx: TransactionReceipt) => {
  try {
    const result = await provider.call(tx, tx.blockNumber);

    if (hexDataLength(result) % 32 === 4 && hexDataSlice(result, 0, 4) === "0x08c379a0") {
      return (defaultAbiCoder.decode(["string"], hexDataSlice(result, 4)) as [string])[0];
    }
  } catch {
    return undefined;
  }
};

const Donut = React.memo(
  CircularProgressbarWithChildren,
  ({ value: prev }, { value: next }) => prev === next
);

type TransactionProgressDonutProps = {
  state: TransactionState["type"];
};

const TransactionProgressDonut: React.FC<TransactionProgressDonutProps> = ({ state }) => {
  const [value, setValue] = useState(0);
  const maxValue = 1;

  useEffect(() => {
    if (state === "confirmed") {
      setTimeout(() => setValue(maxValue), 40);
    } else {
      setTimeout(() => setValue(maxValue * 0.67), 20);
    }
  }, [state]);

  return state === "confirmed" ? (
    <Donut {...{ value, maxValue, ...fastProgress }}>
      <Icon name="check" color="white" size="lg" />
    </Donut>
  ) : state === "failed" || state === "cancelled" ? (
    <Donut value={0} {...{ maxValue, ...fastProgress }}>
      <Icon name="times" color="white" size="lg" />
    </Donut>
  ) : (
    <Donut {...{ value, maxValue, ...slowProgress }}>
      <Icon name="cog" color="white" size="lg" spin />
    </Donut>
  );
};

export const TransactionMonitor: React.FC = () => {
  const { provider } = useLiquity();
  const [transactionState, setTransactionState] = useTransactionState();

  const id = transactionState.type !== "idle" ? transactionState.id : undefined;
  const tx = transactionState.type === "waitingForConfirmation" ? transactionState.tx : undefined;

  useEffect(() => {
    if (id && tx) {
      let cancelled = false;
      let finished = false;

      const txHash = tx.rawSentTransaction.hash;

      const waitForConfirmation = async () => {
        try {
          const receipt = await tx.waitForReceipt();

          if (cancelled) {
            return;
          }

          const { confirmations } = receipt.rawReceipt;
          const blockNumber = receipt.rawReceipt.blockNumber + confirmations - 1;
          console.log(`Block #${blockNumber} ${confirmations}-confirms tx ${txHash}`);
          console.log(`Finish monitoring tx ${txHash}`);
          finished = true;

          if (receipt.status === "succeeded") {
            console.log(`${receipt}`);

            setTransactionState({
              type: "confirmedOneShot",
              id
            });
          } else {
            const reason = await tryToGetRevertReason(provider, receipt.rawReceipt);

            if (cancelled) {
              return;
            }

            console.error(`Tx ${txHash} failed`);
            if (reason) {
              console.error(`Revert reason: ${reason}`);
            }

            setTransactionState({
              type: "failed",
              id,
              error: new Error(reason ? `Reverted: ${reason}` : "Failed")
            });
          }
        } catch (rawError) {
          if (cancelled) {
            return;
          }

          finished = true;

          if (rawError instanceof EthersTransactionCancelledError) {
            console.log(`Cancelled tx ${txHash}`);
            setTransactionState({ type: "cancelled", id });
          } else {
            console.error(`Failed to get receipt for tx ${txHash}`);
            console.error(rawError);

            setTransactionState({
              type: "failed",
              id,
              error: new Error("Failed")
            });
          }
        }
      };

      console.log(`Start monitoring tx ${txHash}`);
      waitForConfirmation();

      return () => {
        if (!finished) {
          setTransactionState({ type: "idle" });
          console.log(`Cancel monitoring tx ${txHash}`);
          cancelled = true;
        }
      };
    }
  }, [provider, id, tx, setTransactionState]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot" && id) {
      // hack: the txn confirmed state lasts 5 seconds which blocks other states, review with Dani
      setTransactionState({ type: "confirmed", id });
    } else if (
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
  }, [transactionState.type, setTransactionState, id]);

  if (transactionState.type === "idle" || transactionState.type === "waitingForApproval") {
    return null;
  }

  return (
    <Flex
      sx={{
        alignItems: "center",
        bg:
          transactionState.type === "confirmed"
            ? "success"
            : transactionState.type === "cancelled"
            ? "warning"
            : transactionState.type === "failed"
            ? "danger"
            : "primary",
        p: 3,
        pl: 4,
        position: "fixed",
        width: "100vw",
        bottom: 0,
        overflow: "hidden"
      }}
    >
      <Box sx={{ mr: 3, width: "40px", height: "40px" }}>
        <TransactionProgressDonut state={transactionState.type} />
      </Box>

      <Text sx={{ fontSize: 3, color: "white" }}>
        {transactionState.type === "waitingForConfirmation"
          ? "Waiting for confirmation"
          : transactionState.type === "cancelled"
          ? "Cancelled"
          : transactionState.type === "failed"
          ? transactionState.error.message
          : "Confirmed"}
      </Text>
    </Flex>
  );
};
