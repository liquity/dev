import { useState, useEffect } from "react";
import { ContractInterface, ethers } from "ethers";
import { useLiquity } from "./LiquityContext";

export function useContract<TContractType>(
  address: string | null,
  abi: ContractInterface
): TContractType | undefined {
  const { provider, liquity } = useLiquity();
  const [contract, setContract] = useState<TContractType>();

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

        setContract(connectedContract);
      } catch (e) {
        console.error(e);
        console.error(
          `Contract ${address} doesn't appear to be deployed. Did you forget to re-run yarn deploy:chicken-bonds?`
        );
      }
    })();
  }, [provider, liquity.connection.signer, address, abi, contract]);

  return contract;
}
