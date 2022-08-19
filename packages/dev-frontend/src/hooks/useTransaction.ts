import { useState, useCallback, useEffect } from "react";
import { TransactionStatus } from "../components/Bonds/context/transitions";

export function useTransaction(
  transactionFunction: (...params: any) => Promise<void>,
  dependencies: any[]
): [(...params: any) => Promise<void>, TransactionStatus] {
  const [status, setStatus] = useState<TransactionStatus>("IDLE");

  useEffect(() => {
    if (status === "CONFIRMED" || status === "FAILED") {
      const timeout = setTimeout(() => {
        setStatus("IDLE");
      }, 2600);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const transaction = useCallback(
    async (...args) => {
      try {
        setStatus("PENDING");
        await transactionFunction(...args);
        setStatus("CONFIRMED");
      } catch (error: unknown) {
        setStatus("FAILED");
        throw new Error(`useTransaction(${args}) ${error}`);
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactionFunction, ...dependencies]
  );

  return [transaction, status];
}
