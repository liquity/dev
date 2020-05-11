import fs from "fs";
import path from "path";

import { Interface, ParamType } from "@ethersproject/abi";

import ActivePool from "../../contracts/artifacts/ActivePool.json";
import BorrowerOperations from "../../contracts/artifacts/BorrowerOperations.json";
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

const getType = ({ baseType, components, arrayChildren }: ParamType, flexible: boolean): string => {
  switch (baseType) {
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

  if (baseType.startsWith("bytes")) {
    return flexible ? "BytesLike" : "string";
  }

  const match = baseType.match(/^(u?int)([0-9]+)$/);
  if (match) {
    return flexible ? "BigNumberish" : parseInt(match[2]) >= 53 ? "BigNumber" : "number";
  }

  throw new Error(`unimplemented type ${baseType}`);
};

export function generate(contractName: string, { functions }: Interface): string {
  return [
    `export declare class ${contractName} extends Contract {`,
    "  readonly [name: string]: unknown;",

    ...Object.values(functions).map(func => {
      const inputs = func.inputs.map((input, i) => [input.name || "arg" + i, getType(input, true)]);

      const overridesType = func.constant
        ? "CallOverrides"
        : func.payable
        ? "PayableOverrides"
        : "Overrides";

      const params = [
        ...inputs.map(([name, type]) => `${name}: ${type}`),
        `_overrides?: ${overridesType}`
      ];

      let returnType: string;
      if (func.constant) {
        if (!func.outputs || func.outputs.length == 0) {
          returnType = "void";
        } else if (func.outputs.length === 1) {
          returnType = getType(func.outputs[0], false);
        } else {
          returnType = getTupleType(func.outputs, false);
        }
      } else {
        returnType = "ContractTransaction";
      }

      return `  ${func.name}(${params.join(", ")}): Promise<${returnType}>;`;
    }),

    "}"
  ].join("\n");
}

const contracts = [
  ActivePool,
  BorrowerOperations,
  CDPManager,
  CLVToken,
  DefaultPool,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
];

export const imports = `import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
//import { BytesLike } from "@ethersproject/bytes";
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
