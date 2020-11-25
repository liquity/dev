import fs from "fs";
import path from "path";

import { Interface, ParamType } from "@ethersproject/abi";

import ActivePool from "../../contracts/artifacts/ActivePool.json";
import BorrowerOperations from "../../contracts/artifacts/BorrowerOperations.json";
import CDPManager from "../../contracts/artifacts/CDPManager.json";
import CLVToken from "../../contracts/artifacts/CLVToken.json";
import CommunityIssuance from "../../contracts/artifacts/CommunityIssuance.json";
import DefaultPool from "../../contracts/artifacts/DefaultPool.json";
import GrowthToken from "../../contracts/artifacts/GrowthToken.json";
import HintHelpers from "../../contracts/artifacts/HintHelpers.json";
import LockupContractFactory from "../../contracts/artifacts/LockupContractFactory.json";
import LQTYStaking from "../../contracts/artifacts/LQTYStaking.json";
import MultiCDPGetter from "../../contracts/artifacts/MultiCDPGetter.json";
import PriceFeed from "../../contracts/artifacts/PriceFeed.json";
import PriceFeedTestnet from "../../contracts/artifacts/PriceFeedTestnet.json";
import SortedCDPs from "../../contracts/artifacts/SortedCDPs.json";
import StabilityPool from "../../contracts/artifacts/StabilityPool.json";
import CollSurplusPool from "../../contracts/artifacts/CollSurplusPool.json";

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

const declareInterface = ({
  contractName,
  interface: { events, functions }
}: {
  contractName: string;
  interface: Interface;
}) =>
  [
    `interface ${contractName}Functions {`,
    ...Object.values(functions).map(({ name, constant, payable, inputs, outputs }) => {
      const overridesType = constant ? "CallOverrides" : payable ? "PayableOverrides" : "Overrides";

      const params = [
        ...inputs.map((input, i) => `${input.name || "arg" + i}: ${getType(input, true)}`),
        `_overrides?: ${overridesType}`
      ];

      let returnType: string;
      if (constant) {
        if (!outputs || outputs.length == 0) {
          returnType = "void";
        } else if (outputs.length === 1) {
          returnType = getType(outputs[0], false);
        } else {
          returnType = getTupleType(outputs, false);
        }
      } else {
        returnType = "ContractTransaction";
      }

      return `  ${name}(${params.join(", ")}): Promise<${returnType}>;`;
    }),
    "}\n",

    `export interface ${contractName}`,
    `  extends TypedContract<LiquityContract, ${contractName}Functions> {`,

    "  readonly filters: {",
    ...Object.values(events).map(({ name, inputs }) => {
      const params = inputs.map(
        input => `${input.name}?: ${input.indexed ? `${getType(input, true)} | null` : "null"}`
      );

      return `    ${name}(${params.join(", ")}): EventFilter;`;
    }),
    "  };",

    ...Object.values(events).map(
      ({ name, inputs }) =>
        `  extractEvents(logs: Log[], name: "${name}"): TypedLogDescription<${getTupleType(
          inputs,
          false
        )}>[];`
    ),

    "}"
  ].join("\n");

const contractArtifacts = [
  ActivePool,
  BorrowerOperations,
  CDPManager,
  CLVToken,
  CommunityIssuance,
  DefaultPool,
  GrowthToken,
  HintHelpers,
  LockupContractFactory,
  LQTYStaking,
  MultiCDPGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedCDPs,
  StabilityPool,
  CollSurplusPool
];

const contracts = contractArtifacts.map(({ contractName, abi }) => ({
  contractName,
  interface: new Interface(abi)
}));

const output = `
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  ContractTransaction,
  EventFilter
} from "@ethersproject/contracts";

import { LiquityContract, TypedContract, TypedLogDescription } from "../src/contracts";

${contracts.map(declareInterface).join("\n\n")}
`;

fs.mkdirSync("types", { recursive: true });
fs.writeFileSync(path.join("types", "index.ts"), output);

fs.mkdirSync("abi", { recursive: true });
contractArtifacts.forEach(({ contractName, abi }) =>
  fs.writeFileSync(path.join("abi", `${contractName}.json`), JSON.stringify(abi, undefined, 2))
);
