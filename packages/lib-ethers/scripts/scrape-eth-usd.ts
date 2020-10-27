import fs from "fs";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Contract, CallOverrides, EventFilter } from "@ethersproject/contracts";
import { getDefaultProvider } from "@ethersproject/providers";

import { Decimal } from "@liquity/decimal";

const outputFile = "eth-usd.csv";

const answerDecimals = 8;
const liquityDecimals = 18;
const answerMultiplier = BigNumber.from(10).pow(liquityDecimals - answerDecimals);

const aggregatorAddress = "0xF79D6aFBb6dA890132F9D7c355e3015f15F3406F";

const aggregatorAbi = [
  "function latestAnswer() view returns (int256)",
  "function latestTimestamp() view returns (uint256)",
  "function latestRound() view returns (uint256)",
  "function getAnswer(uint256 roundId) view returns (int256)",
  "function getTimestamp(uint256 roundId) view returns (uint256)",

  "event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 timestamp)",
  "event NewRound(uint256 indexed roundId, address indexed startedBy)"
];

declare class Aggregator extends Contract {
  readonly [name: string]: unknown;

  latestAnswer(_overrides?: CallOverrides): Promise<BigNumber>;
  latestTimestamp(_overrides?: CallOverrides): Promise<BigNumber>;
  latestRound(_overrides?: CallOverrides): Promise<BigNumber>;
  getAnswer(roundId: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getTimestamp(roundId: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;

  filters: {
    AnswerUpdated(current?: BigNumberish, roundId?: BigNumberish, timestamp?: null): EventFilter;
    NewRound(roundId?: BigNumberish, startedBy?: string): EventFilter;
  };
}

function* range(start: number, end: number) {
  for (let i = start; i < end; ++i) {
    yield i;
  }
}

const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);

  return (
    // Weird that Google Sheets likes this mixed format...
    `${date.toLocaleDateString("en-US", { timeZone: "UTC" })} ` +
    `${date.toLocaleTimeString("en-GB", { timeZone: "UTC" })}`
  );
};

(async () => {
  const provider = getDefaultProvider("mainnet");
  const aggregator = new Contract(aggregatorAddress, aggregatorAbi, provider) as Aggregator;

  const getRound = (roundId: BigNumberish) =>
    Promise.all([
      aggregator.getTimestamp(roundId),
      aggregator.getAnswer(roundId)
    ]).then(([timestamp, answer]) => [
      roundId.toString(),
      timestamp.toString(),
      formatDateTime(timestamp.toNumber()),
      new Decimal(answer.mul(answerMultiplier)).toString()
    ]);

  const roundsPerPass = 10;
  const latestRound = (await aggregator.latestRound()).toNumber();
  const passes = Math.ceil((latestRound + 1) / roundsPerPass);

  fs.writeFileSync(outputFile, "");

  for (let pass = 0; pass < passes; ++pass) {
    const start = pass * roundsPerPass;
    const end = Math.min((pass + 1) * roundsPerPass, latestRound + 1);

    console.log(`Pass ${pass} out of ${passes} (rounds ${start} - ${end - 1})`);

    const answers = await Promise.all(Array.from(range(start, end)).map(i => getRound(i)));
    fs.appendFileSync(outputFile, answers.map(answer => answer.join(",")).join("\n") + "\n");
  }
})();
