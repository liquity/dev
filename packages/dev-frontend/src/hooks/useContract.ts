import { useState, useEffect } from "react";
import { ContractInterface, ethers } from "ethers";
import { useLiquity } from "./LiquityContext";

type ContractStatus = "UNKNOWN" | "LOADED" | "FAILED";
type Contract<TContractType> = { instance: TContractType | undefined; status: ContractStatus };

export function useContract<TContractType>(
  address: string | null,
  abi: ContractInterface
): [TContractType | undefined, ContractStatus] {
  const { provider, liquity } = useLiquity();
  const [contract, setContract] = useState<Contract<TContractType>>();

  useEffect(() => {
    (async () => {
      try {
        if (contract !== undefined || address === null) return;

        // TODO: only useful in dev mode
        const exists = (await provider.getCode(address)) !== "0x";
        if (!exists) throw new Error(`Contract ${address} doesn't exist.`);

        const connectedContract = (new ethers.Contract(
          address,
          abi,
          liquity.connection.signer
        ) as unknown) as TContractType;

        setContract({ instance: connectedContract, status: "LOADED" });
      } catch (e) {
        setContract({ instance: undefined, status: "FAILED" });
        console.error(e);
        console.error(
          `Contract ${address} doesn't appear to be deployed. Did you forget to re-run yarn deploy:chicken-bonds?`
        );
      }
    })();
  }, [provider, liquity.connection.signer, address, abi, contract]);

  return [contract?.instance, contract?.status || "UNKNOWN"];
}
