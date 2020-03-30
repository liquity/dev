import { Log } from "ethers/providers";
import { Interface, LogDescription, BigNumber, bigNumberify } from "ethers/utils";

import { LiquityContracts } from "./contracts";
import { Decimal } from "../utils";

export const contractsToInterfaces = (contracts: LiquityContracts) => {
  return Object.entries(contracts).reduce<{ [address: string]: [string, Interface] }>(
    (interfaces, [name, contract]) => ({
      ...interfaces,
      [contract.address]: [name, contract.interface]
    }),
    {}
  );
};

export const parseLogs = (
  logs: Log[],
  interfaces: { [address: string]: [string, Interface] }
): [[string, LogDescription][], Log[]] => {
  const parsedLogs: [string, LogDescription][] = [];
  const unparsedLogs: Log[] = [];

  logs.forEach(log => {
    if (log.address in interfaces) {
      const [name, iface] = interfaces[log.address];
      parsedLogs.push([name, iface.parseLog(log)]);
    } else {
      unparsedLogs.push(log);
    }
  });

  return [parsedLogs, unparsedLogs];
};

const VERY_BIG = bigNumberify(10).pow(9);

export const logDescriptionToString = (logDescription: LogDescription) => {
  const prettyValues = Array.from(logDescription.values as ArrayLike<unknown>).map(value => {
    if (BigNumber.isBigNumber(value)) {
      if (value.gte(VERY_BIG)) {
        return new Decimal(value).toString() + "e18";
      } else {
        return value.toString();
      }
    } else if (typeof value === "string") {
      return value === "0x0000000000000000000000000000000000000000" ? "address(0)" : value;
    } else {
      return String(value);
    }
  });

  return `${logDescription.name}(${prettyValues.join(", ")})`;
};
