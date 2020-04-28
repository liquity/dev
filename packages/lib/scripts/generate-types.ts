import fs from "fs";
import path from "path";

import { Interface, ParamType } from "@ethersproject/abi";

import ActivePool from "../../contracts/artifacts/ActivePool.json";
import CDPManager from "../../contracts/artifacts/CDPManager.json";
import CLVToken from "../../contracts/artifacts/CLVToken.json";
import DefaultPool from "../../contracts/artifacts/DefaultPool.json";
import PoolManager from "../../contracts/artifacts/PoolManager.json";
import PriceFeed from "../../contracts/artifacts/PriceFeed.json";
import SortedCDPs from "../../contracts/artifacts/SortedCDPs.json";
import StabilityPool from "../../contracts/artifacts/StabilityPool.json";

const getTupleType = (components: ParamType[], flexible: boolean) => {
  if (components.every(component => component.name)) {
    return (
      "{ " +
      components.map(component => `${component.name}: ${getType(component, flexible)}`).join("; ") +
      " }"
    );
  } else {
    return `[${components.map(component => getType(component, flexible)).join(", ")}]`;
  }
};

const getType = ({ type, components, arrayChildren }: ParamType, flexible: boolean): string => {
  switch (type) {
    case "address":
    case "string":
      return "string";

    case "bool":
      return "boolean";

    case "array":
      return `${getType(arrayChildren, flexible)}[]`;

    case "tuple":
      return getTupleType(components, flexible);
  }

  if (type.startsWith("bytes")) {
    return flexible ? "string | BytesLike" : "string";
  }

  const match = type.match(/^(u?int)([0-9]+)$/);
  if (match) {
    return flexible ? "BigNumberish" : parseInt(match[2]) >= 53 ? "BigNumber" : "number";
  }

  throw new Error(`unimplemented type ${type}`);
};

export function generate(contractName: string, iface: Interface): string {
  const functions = Object.entries(iface.functions).filter(([signature]) => signature.includes("("));

  return `export declare class ${contractName} extends Contract {
${functions
  .map(([signature, funktion]) => {
    const inputs = funktion.inputs.map((input, i) => [
      input.name || "arg" + i,
      getType(input, true)
    ]);

    const overridesType = funktion.constant
      ? "CallOverrides"
      : funktion.payable
      ? "PayableOverrides"
      : "Overrides";

    const params = [
      ...inputs.map(([name, type]) => `${name}: ${type}`),
      `_overrides?: ${overridesType}`
    ];

    let returnType: string;
    if (funktion.constant) {
      if (!funktion.outputs || funktion.outputs.length == 0) {
        returnType = "void";
      } else if (funktion.outputs.length === 1) {
        returnType = getType(funktion.outputs[0], false);
      } else {
        returnType = getTupleType(funktion.outputs, false);
      }
    } else {
      returnType = "ContractTransaction";
    }

    return `  ${funktion.name}(${params.join(", ")}): Promise<${returnType}>;`;
  })
  .join("\n")}
}`;
}

const contracts = [
  ActivePool,
  CDPManager,
  CLVToken,
  DefaultPool,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
];

export const imports = `import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import {
  Contract,
  Overrides,
  CallOverrides,
  PayableOverrides,
  ContractTransaction
} from "@ethersproject/contracts";

`;

const output =
  imports +
  contracts.map(({ contractName, abi }) => generate(contractName, new Interface(abi))).join("\n\n");

fs.mkdirSync("types", { recursive: true });
fs.writeFileSync("types/index.ts", output);

contracts
  .map(({ contractName }) => `${contractName}.json`)
  .forEach(contractJson =>
    fs.copyFileSync(
      path.join("..", "contracts", "artifacts", contractJson),
      path.join("types", contractJson)
    )
  );
