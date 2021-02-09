import fs from "fs";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Contract, CallOverrides, EventFilter } from "@ethersproject/contracts";
import { AlchemyProvider } from "@ethersproject/providers";

import { Decimal } from "@liquity/lib-base";

const outputFile = "eth-usd.csv";

const phase = 2;
const answerDecimals = 8;
const liquityDecimals = 18;
const answerMultiplier = BigNumber.from(10).pow(liquityDecimals - answerDecimals);
const firstRound = BigNumber.from("0x10000000000000000").mul(phase);

const aggregatorAddress = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

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

function* range(start: BigNumber, end: BigNumber) {
  for (let i = start; i.lt(end); i = i.add(1)) {
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
  const provider = new AlchemyProvider("mainnet", "LfzNw5K5sLuITGhCxFObHJWMHY_1HW6M");
  const aggregator = new Contract(aggregatorAddress, aggregatorAbi, provider) as Aggregator;

  const getRound = (roundId: BigNumberish) =>
    Promise.all([
      aggregator.getTimestamp(roundId),
      aggregator.getAnswer(roundId)
    ]).then(([timestamp, answer]) => [
      `${roundId}`,
      `${timestamp}`,
      formatDateTime(timestamp.toNumber()),
      `${Decimal.fromBigNumberString(answer.mul(answerMultiplier).toHexString())}`
    ]);

  const roundsPerPass = 10;
  // const latestRound = await aggregator.latestRound();
  const latestRound = BigNumber.from("0x200000000000015A6");
  const totalRounds = latestRound.sub(firstRound).toNumber();
  const passes = Math.ceil((totalRounds + 1) / roundsPerPass);

  fs.writeFileSync(outputFile, "");

  for (let pass = 0; pass < passes; ++pass) {
    const start = firstRound.add(pass * roundsPerPass);
    const end = firstRound.add(Math.min((pass + 1) * roundsPerPass, totalRounds + 1));

    console.log(`Pass ${pass} out of ${passes} (rounds ${start} - ${end.sub(1)})`);

    const answers = await Promise.all(Array.from(range(start, end)).map(i => getRound(i)));
    fs.appendFileSync(outputFile, answers.map(answer => answer.join(",")).join("\n") + "\n");
  }
})();
