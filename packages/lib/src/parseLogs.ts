import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { LogDescription, Interface } from "@ethersproject/abi";

import { Decimal } from "@liquity/decimal";
import { LiquityContracts } from "./contracts";

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

const VERY_BIG = BigNumber.from(10).pow(9);

const substituteName = (address: string, names: { [address: string]: [string, Interface?] }) =>
  address in names ? names[address][0] : address;

export const logDescriptionToString = (
  logDescription: LogDescription,
  names?: { [address: string]: [string, Interface?] }
) => {
  const prettyValues = logDescription.args.map(arg => {
    if (BigNumber.isBigNumber(arg)) {
      if (arg.gte(VERY_BIG)) {
        return new Decimal(arg).toString() + "e18";
      } else {
        return arg.toString();
      }
    } else if (typeof arg === "string") {
      return arg === "0x0000000000000000000000000000000000000000"
        ? "address(0)"
        : names
        ? substituteName(arg, names)
        : arg;
    } else {
      return String(arg);
    }
  });

  return `${logDescription.name}(${prettyValues.join(", ")})`;
};
