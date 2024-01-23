import { useState, useEffect } from "react";
import { ContractInterface, ethers } from "ethers";
import { useLiquity } from "./LiquityContext";

type ContractStatus = "UNKNOWN" | "LOADED" | "FAILED";
type Contract<TContractType> = { instance: TContractType | undefined; status: ContractStatus };

export function useContract<TContractType>(
  address: string | null,
  abi: ContractInterface
): [TContractType | undefined, ContractStatus] {
  const { provider } = useLiquity();
  const [contract, setContract] = useState<Contract<TContractType>>();

  useEffect(() => {
    (async () => {
      try {
        if (contract !== undefined) return;
        if (address === null) {
          setContract({ instance: undefined, status: "FAILED" });
          return;
        }

        const exists = (await provider.getCode(address)) !== "0x";
        if (!exists) throw new Error(`Contract ${address} doesn't exist.`);

        const connectedContract = (new ethers.Contract(
          address,
          abi,
          provider
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
  }, [provider, address, abi, contract]);

  return [contract?.instance, contract?.status || "UNKNOWN"];
}
