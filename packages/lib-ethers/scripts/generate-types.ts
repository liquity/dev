import fs from "fs-extra";
import path from "path";

import { Interface, ParamType } from "@ethersproject/abi";

import ActivePool from "../../contracts/artifacts/contracts/ActivePool.sol/ActivePool.json";
import BorrowerOperations from "../../contracts/artifacts/contracts/BorrowerOperations.sol/BorrowerOperations.json";
import CollSurplusPool from "../../contracts/artifacts/contracts/CollSurplusPool.sol/CollSurplusPool.json";
import CommunityIssuance from "../../contracts/artifacts/contracts/LQTY/CommunityIssuance.sol/CommunityIssuance.json";
import DefaultPool from "../../contracts/artifacts/contracts/DefaultPool.sol/DefaultPool.json";
import ERC20Mock from "../../contracts/artifacts/contracts/LPRewards/TestContracts/ERC20Mock.sol/ERC20Mock.json";
import GasPool from "../../contracts/artifacts/contracts/GasPool.sol/GasPool.json";
import HintHelpers from "../../contracts/artifacts/contracts/HintHelpers.sol/HintHelpers.json";
import IERC20 from "../../contracts/artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import LockupContractFactory from "../../contracts/artifacts/contracts/LQTY/LockupContractFactory.sol/LockupContractFactory.json";
import LUSDToken from "../../contracts/artifacts/contracts/LUSDToken.sol/LUSDToken.json";
import LQTYStaking from "../../contracts/artifacts/contracts/LQTY/LQTYStaking.sol/LQTYStaking.json";
import LQTYToken from "../../contracts/artifacts/contracts/LQTY/LQTYToken.sol/LQTYToken.json";
import MultiTroveGetter from "../../contracts/artifacts/contracts/MultiTroveGetter.sol/MultiTroveGetter.json";
import PriceFeed from "../../contracts/artifacts/contracts/PriceFeed.sol/PriceFeed.json";
import PriceFeedTestnet from "../../contracts/artifacts/contracts/TestContracts/PriceFeedTestnet.sol/PriceFeedTestnet.json";
import SortedTroves from "../../contracts/artifacts/contracts/SortedTroves.sol/SortedTroves.json";
import StabilityPool from "../../contracts/artifacts/contracts/StabilityPool.sol/StabilityPool.json";
import TroveManager from "../../contracts/artifacts/contracts/TroveManager.sol/TroveManager.json";
import Unipool from "../../contracts/artifacts/contracts/LPRewards/Unipool.sol/Unipool.json";

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
    `interface ${contractName}Calls {`,
    ...Object.values(functions)
      .filter(({ constant }) => constant)
      .map(({ name, inputs, outputs }) => {
        const params = [
          ...inputs.map((input, i) => `${input.name || "arg" + i}: ${getType(input, true)}`),
          `_overrides?: CallOverrides`
        ];

        let returnType: string;
        if (!outputs || outputs.length == 0) {
          returnType = "void";
        } else if (outputs.length === 1) {
          returnType = getType(outputs[0], false);
        } else {
          returnType = getTupleType(outputs, false);
        }

        return `  ${name}(${params.join(", ")}): Promise<${returnType}>;`;
      }),
    "}\n",

    `interface ${contractName}Transactions {`,
    ...Object.values(functions)
      .filter(({ constant }) => !constant)
      .map(({ name, payable, inputs, outputs }) => {
        const overridesType = payable ? "PayableOverrides" : "Overrides";

        const params = [
          ...inputs.map((input, i) => `${input.name || "arg" + i}: ${getType(input, true)}`),
          `_overrides?: ${overridesType}`
        ];

        let returnType: string;
        if (!outputs || outputs.length == 0) {
          returnType = "void";
        } else if (outputs.length === 1) {
          returnType = getType(outputs[0], false);
        } else {
          returnType = getTupleType(outputs, false);
        }

        return `  ${name}(${params.join(", ")}): Promise<${returnType}>;`;
      }),
    "}\n",

    `export interface ${contractName}`,
    `  extends _TypedLiquityContract<${contractName}Calls, ${contractName}Transactions> {`,

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
        `  extractEvents(logs: Log[], name: "${name}"): _TypedLogDescription<${getTupleType(
          inputs,
          false
        )}>[];`
    ),

    "}"
  ].join("\n");

const contractArtifacts = [
  ActivePool,
  BorrowerOperations,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  ERC20Mock,
  GasPool,
  HintHelpers,
  IERC20,
  LockupContractFactory,
  LUSDToken,
  LQTYStaking,
  LQTYToken,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  TroveManager,
  Unipool
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
  EventFilter
} from "@ethersproject/contracts";

import { _TypedLiquityContract, _TypedLogDescription } from "../src/contracts";

${contracts.map(declareInterface).join("\n\n")}
`;

fs.mkdirSync("types", { recursive: true });
fs.writeFileSync(path.join("types", "index.ts"), output);

fs.removeSync("abi");
fs.mkdirSync("abi", { recursive: true });
contractArtifacts.forEach(({ contractName, abi }) =>
  fs.writeFileSync(path.join("abi", `${contractName}.json`), JSON.stringify(abi, undefined, 2))
);
