import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Log } from "@ethersproject/abstract-provider";
import { LogDescription, Interface } from "@ethersproject/abi";

import { Decimal } from "@liquity/decimal";
import { LiquityContracts } from "./contracts";

const GAS_POOL_ADDRESS = "0x00000000000000000000000000000000000009A5";

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

const prettify = (arg: unknown, names?: { [address: string]: string }) => {
  if (BigNumber.isBigNumber(arg)) {
    if (arg.gte(VERY_BIG)) {
      return new Decimal(arg).toString() + "e18";
    } else {
      return arg.toString();
    }
  } else if (typeof arg === "string") {
    return arg === AddressZero
      ? "address(0)"
      : arg === GAS_POOL_ADDRESS
      ? "gasPool"
      : names && arg in names
      ? names[arg]
      : arg;
  } else {
    return String(arg);
  }
};

export const logDescriptionToString = (
  logDescription: LogDescription,
  names?: { [address: string]: string }
) => {
  const prettyEntries = Object.entries(logDescription.args)
    .filter(([key]) => !key.match(/^[0-9]/))
    .map(([key, value]) => `${key}: ${prettify(value, names)}`);

  return `${logDescription.name}({ ${prettyEntries.join(", ")} })`;
};
