import React, { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { Flex, Text, Box } from "theme-ui";
import { Provider, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { hexDataSlice, hexDataLength } from "@ethersproject/bytes";
import { defaultAbiCoder } from "@ethersproject/abi";

import { buildStyles, CircularProgressbarWithChildren } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import { SimpleTransaction } from "@liquity/lib-base";
import {
  EthersTransactionOverrides,
  parseLogs,
  logDescriptionToString,
  contractsToInterfaces
} from "@liquity/lib-ethers";
import { useLiquity } from "../hooks/LiquityContext";
import { Tooltip, TooltipProps, Hoverable } from "./Tooltip";
import { Icon } from "./Icon";

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
  type: "waitingForConfirmations";
  id: string;
  tx: TransactionResponse;
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
  disabled?: boolean;
  variant?: string;
  onClick?: () => void;
};

export type TransactionFunction = (
  overrides?: EthersTransactionOverrides
) => Promise<SimpleTransaction<TransactionResponse, TransactionReceipt>>;

type TransactionProps<C> = {
  id: string;
  tooltip?: string;
  tooltipPlacement?: TooltipProps<C>["placement"];
  requires?: readonly (readonly [boolean, string])[];
  send: TransactionFunction;
  numberOfConfirmationsToWait?: number;
  children: C;
};

export function Transaction<C extends React.ReactElement<ButtonlikeProps & Hoverable>>({
  id,
  tooltip,
  tooltipPlacement,
  requires,
  send,
  numberOfConfirmationsToWait = 1,
  children
}: TransactionProps<C>) {
  const [transactionState, setTransactionState] = useTransactionState();
  const { devChain } = useLiquity();
  const trigger = React.Children.only<C>(children);

  numberOfConfirmationsToWait = devChain ? 1 : numberOfConfirmationsToWait;

  const sendTransaction = useCallback(async () => {
    setTransactionState({ type: "waitingForApproval", id });

    try {
      const tx = await send({
        // TODO get a safe gas price from ethgasstation
        // Note that this only applies to mainnet though, which we don't support yet
        gasPrice: 2000000000
      });

      setTransactionState({
        type: "waitingForConfirmations",
        id,
        tx: tx.rawTransaction,
        confirmations: 0,
        numberOfConfirmationsToWait
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
const tryToGetRevertReason = async (provider: Provider, hash: string) => {
  try {
    const tx = await provider.getTransaction(hash);
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
  confirmations?: number;
  numberOfConfirmationsToWait?: number;
};

const TransactionProgressDonut: React.FC<TransactionProgressDonutProps> = ({
  state,
  confirmations,
  numberOfConfirmationsToWait
}) => {
  const [value, setValue] = useState(0);
  const maxValue = numberOfConfirmationsToWait || 1;
  const targetValue = (confirmations ?? 0) + 1;

  useEffect(() => {
    if (state === "confirmed") {
      setTimeout(() => setValue(maxValue), 40);
    } else {
      setTimeout(() => setValue(targetValue - 1 / 3), 20);
    }
  }, [state, targetValue, maxValue]);

  return state === "confirmed" ? (
    <Donut value={value} maxValue={maxValue} {...fastProgress}>
      <Icon name="check" color="white" size="lg" />
    </Donut>
  ) : state === "failed" || state === "cancelled" ? (
    <Donut value={0} maxValue={maxValue} {...fastProgress}>
      <Icon name="times" color="white" size="lg" />
    </Donut>
  ) : (
    <Donut {...{ value, maxValue, ...slowProgress }}>
      <Icon name="cog" color="white" size="lg" spin />
    </Donut>
  );
};

export const TransactionMonitor: React.FC = () => {
  const { provider, contracts, account } = useLiquity();
  const [transactionState, setTransactionState] = useTransactionState();

  const interfaces = useMemo(() => contractsToInterfaces(contracts), [contracts]);
  const names = useMemo(
    () => ({
      [account]: "user",
      ...Object.fromEntries(Object.entries(interfaces).map(([address, [name]]) => [address, name]))
    }),
    [account, interfaces]
  );

  const id = transactionState.type !== "idle" ? transactionState.id : undefined;

  const tx = transactionState.type === "waitingForConfirmations" ? transactionState.tx : undefined;

  const numberOfConfirmationsToWait =
    transactionState.type === "waitingForConfirmations" || transactionState.type === "confirmed"
      ? transactionState.numberOfConfirmationsToWait
      : undefined;

  const confirmations =
    transactionState.type === "waitingForConfirmations" ? transactionState.confirmations : undefined;

  useEffect(() => {
    if (id && tx && numberOfConfirmationsToWait) {
      let cancelled = false;
      let finished = false;
      let dumpedLogs = false;
      let confirmations = 0;

      const waitForConfirmations = async () => {
        try {
          while (confirmations < numberOfConfirmationsToWait) {
            const receipt = await tx.wait(Math.min(confirmations + 1, numberOfConfirmationsToWait));

            if (cancelled) {
              return;
            }

            if (receipt.blockNumber !== undefined && receipt.confirmations !== undefined) {
              const blockNumber = receipt.blockNumber + receipt.confirmations - 1;
              confirmations = receipt.confirmations;
              console.log(`Block #${blockNumber} ${confirmations}-confirms tx ${tx.hash}`);
            }

            if (receipt.logs && !dumpedLogs) {
              const [parsedLogs, unparsedLogs] = parseLogs(receipt.logs, interfaces);

              if (parsedLogs.length > 0) {
                console.log(
                  `Logs of tx ${tx.hash}:\n` +
                    parsedLogs
                      .map(
                        ([contractName, logDescription]) =>
                          `  ${contractName}.${logDescriptionToString(logDescription, names)}`
                      )
                      .join("\n")
                );
              }

              if (unparsedLogs.length > 0) {
                console.warn("Warning: not all logs were parsed. Unparsed logs:");
                console.warn(unparsedLogs);
              }

              dumpedLogs = true;
            }

            if (confirmations < numberOfConfirmationsToWait) {
              setTransactionState({
                type: "waitingForConfirmations",
                id,
                tx,
                numberOfConfirmationsToWait,
                confirmations
              });
            } else {
              setTransactionState({
                type: "confirmed",
                id,
                numberOfConfirmationsToWait
              });
            }
          }
        } catch (rawError) {
          if (cancelled) {
            return;
          }

          console.error(`Tx ${tx.hash} failed`);
          console.error(rawError);

          const reason = await tryToGetRevertReason(provider, tx.hash!);

          if (cancelled) {
            return;
          }

          setTransactionState({
            type: "failed",
            id,
            error: Error(reason ? `Reverted: ${reason}` : "Failed")
          });
        }

        console.log(`Finish monitoring tx ${tx.hash}`);
        finished = true;
      };

      console.log(`Start monitoring tx ${tx.hash}`);
      waitForConfirmations();

      return () => {
        if (!finished) {
          setTransactionState({ type: "idle" });
          console.log(`Cancel monitoring tx ${tx.hash}`);
          cancelled = true;
        }
      };
    }
  }, [
    provider,
    account,
    interfaces,
    names,
    id,
    tx,
    numberOfConfirmationsToWait,
    setTransactionState
  ]);

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
        overflow: "hidden",
        zIndex: 2
      }}
    >
      <Box sx={{ mr: 3, width: "40px", height: "40px" }}>
        <TransactionProgressDonut
          state={transactionState.type}
          {...{ confirmations, numberOfConfirmationsToWait }}
        />
      </Box>

      <Text sx={{ fontSize: 3, color: "white" }}>
        {transactionState.type === "waitingForConfirmations"
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
