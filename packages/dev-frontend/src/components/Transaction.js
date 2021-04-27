import React, { useState, useContext, useEffect, useCallback } from "react";
import { hexDataSlice, hexDataLength } from "@ethersproject/bytes";
import { defaultAbiCoder } from "@ethersproject/abi";

import "react-circular-progressbar/dist/styles.css";

import { useLiquity } from "../hooks/LiquityContext";

import { Tooltip } from "./Tooltips";
import Modal from "./Modal";
import { Spinner } from "./Loader";

const TransactionContext = React.createContext(undefined);

export const TransactionProvider = ({ children }) => {
  const transactionState = useState({ type: "idle" });
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

export const useMyTransactionState = myId => {
  const [transactionState] = useTransactionState();

  return transactionState.type !== "idle" &&
    (typeof myId === "string" ? transactionState.id === myId : transactionState.id.match(myId))
    ? transactionState
    : { type: "idle" };
};

const hasMessage = error =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

export const useTransactionFunction = (id, send) => {
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

export function Transaction({
  id,
  tooltip,
  tooltipPlacement,
  showFailure,
  requires,
  send,
  children
}) {
  const [sendTransaction, transactionState] = useTransactionFunction(id, send);
  const trigger = React.Children.only(children);

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
const tryToGetRevertReason = async (provider, hash) => {
  try {
    const tx = await provider.getTransaction(hash);
    const result = await provider.call(tx, tx.blockNumber);

    if (hexDataLength(result) % 32 === 4 && hexDataSlice(result, 0, 4) === "0x08c379a0") {
      return defaultAbiCoder.decode(["string"], hexDataSlice(result, 4))[0];
    }
  } catch {
    return undefined;
  }
};

export const TransactionMonitor = () => {
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
            const reason = await tryToGetRevertReason(provider, txHash);

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

          console.error(`Failed to get receipt for tx ${txHash}`);
          console.error(rawError);

          setTransactionState({
            type: "failed",
            id,
            error: new Error("Failed")
          });
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

  if (["idle", "waitingForApproval", "confirmed"].includes(transactionState.type)) {
    return null;
  }

  return (
    <Modal
      bigStatus={
        transactionState.type === "cancelled"
          ? "warning"
          : transactionState.type === "failed"
          ? "danger"
          : ""
      }
      title={
        transactionState.type === "waitingForConfirmation"
          ? "Waiting for confirmation"
          : transactionState.type === "waitingForApproval"
          ? "Pending"
          : transactionState.type === "cancelled"
          ? "Transaction cancelled"
          : transactionState.type === "failed"
          ? "Transaction rejected"
          : ""
      }
    >
      {["waitingForApproval", "waitingForConfirmation"].includes(transactionState.type) && (
        <Spinner />
      )}
    </Modal>
  );
};
