import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { Log, TransactionReceipt } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";
import { LogDescription, Interface } from "@ethersproject/abi";

import { Decimal } from "@liquity/decimal";

type InterfaceLookup = {
  [address: string]: Interface;
};

type NameLookup = {
  [address: string]: string;
};

const interfaceLookupFrom = (contracts: Record<string, Contract>): InterfaceLookup => {
  return Object.fromEntries(
    Object.entries(contracts).map(([, contract]) => [contract.address, contract.interface])
  );
};

const nameLookupFrom = (contracts: Record<string, Contract>): NameLookup => {
  return Object.fromEntries(
    Object.entries(contracts).map(([name, contract]) => [contract.address, name])
  );
};

type ParsedLog = {
  address: string;
  logDescription: LogDescription;
};

const tryToParseLog = (log: Log, interfaceLookup: InterfaceLookup): ParsedLog | undefined => {
  const { address } = log;

  if (address in interfaceLookup) {
    try {
      return { address, logDescription: interfaceLookup[address].parseLog(log) };
    } catch (err) {
      console.warn("Failed to parse log:");
      console.warn(log);
      console.warn("Caught:");
      console.warn(err);
    }
  }
};

const parseLogs = (
  logs: Log[],
  interfaceLookup: InterfaceLookup
): [parsedLogs: ParsedLog[], unparsedLogs: Log[]] => {
  const parsedLogs: ParsedLog[] = [];
  const unparsedLogs: Log[] = [];

  logs.forEach(log => {
    const parsedLog = tryToParseLog(log, interfaceLookup);

    if (parsedLog) {
      parsedLogs.push(parsedLog);
    } else {
      unparsedLogs.push(log);
    }
  });

  return [parsedLogs, unparsedLogs];
};

const VERY_BIG = BigNumber.from(10).pow(9);

const prettify = (arg: unknown, nameLookup: NameLookup) => {
  if (BigNumber.isBigNumber(arg)) {
    if (arg.gte(VERY_BIG)) {
      return new Decimal(arg).toString() + "e18";
    } else {
      return arg.toString();
    }
  } else if (typeof arg === "string") {
    return arg === AddressZero
      ? "address(0)"
      : nameLookup && arg in nameLookup
      ? nameLookup[arg]
      : arg;
  } else {
    return String(arg);
  }
};

const logDescriptionToString = (logDescription: LogDescription, nameLookup: NameLookup) => {
  const prettyEntries = Object.entries(logDescription.args)
    .filter(([key]) => !key.match(/^[0-9]/))
    .map(([key, value]) => `${key}: ${prettify(value, nameLookup)}`);

  return `${logDescription.name}({ ${prettyEntries.join(", ")} })`;
};

export const logsToString = (
  receipt: TransactionReceipt,
  contracts: Record<string, Contract>
): string => {
  const interfaceLookup = interfaceLookupFrom(contracts);
  const contractNameLookup = nameLookupFrom(contracts);

  const nameLookup = {
    [receipt.from]: "user",
    ...contractNameLookup
  };

  const [parsedLogs, unparsedLogs] = parseLogs(receipt.logs, interfaceLookup);

  if (unparsedLogs.length > 0) {
    console.warn("Warning: not all logs were parsed. Unparsed logs:");
    console.warn(unparsedLogs);
  }

  if (parsedLogs.length > 0) {
    return (
      `Logs of tx ${receipt.transactionHash}:\n` +
      parsedLogs
        .map(
          ({ address, logDescription }) =>
            `  ${contractNameLookup[address]}.${logDescriptionToString(logDescription, nameLookup)}`
        )
        .join("\n")
    );
  } else {
    return `No logs were parsed in tx ${receipt.transactionHash}`;
  }
};
