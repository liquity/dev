import assert from "assert";

import { BigNumber } from "@ethersproject/bignumber";
import { TransactionReceipt } from "@ethersproject/abstract-provider";

import { EthersTransactionFailedError, SentEthersLiquityTransaction } from "@liquity/lib-ethers";
import { MinedReceipt } from "@liquity/lib-base";

// Supports a max of 8 million gas
const intervalWidth = 10000;
const numberOfBins = 800;

const retryUpTo = async (
  times: number,
  sendTx: () => Promise<SentEthersLiquityTransaction>
): Promise<[retries: number, receipt: MinedReceipt<TransactionReceipt>]> => {
  let retries = 0;

  for (;;) {
    const tx = await sendTx();
    const receipt = await tx.waitForReceipt();

    if (
      receipt.status === "succeeded" ||
      receipt.rawReceipt.gasUsed.lt(tx.rawSentTransaction.gasLimit) ||
      retries === times
    ) {
      if (receipt.status === "succeeded" && retries) {
        console.log(`// Retry succeeded with gasLimit = ${tx.rawSentTransaction.gasLimit}`);
      }

      return [retries, receipt];
    }

    console.log(`// !!! Ran out of gas with gasLimit = ${tx.rawSentTransaction.gasLimit}`);
    retries++;
  }
};

export class GasHistogram<T> {
  expectedFailures = 0;
  outOfGasFailures = 0;

  private readonly gasUsedBins = new Array<number>(numberOfBins).fill(0);

  private addToGasUsedHisto(gasUsed: BigNumber) {
    const binIndex = Math.floor(gasUsed.toNumber() / intervalWidth);
    assert(binIndex < this.gasUsedBins.length);
    this.gasUsedBins[binIndex]++;
  }

  getResults(): [intervalMin: number, frequency: number][] {
    const firstNonZeroIndex = this.gasUsedBins.findIndex(x => x > 0);
    const firstNonZeroIndexFromEnd = this.gasUsedBins
      .slice()
      .reverse()
      .findIndex(x => x > 0);

    return this.gasUsedBins
      .slice(firstNonZeroIndex, this.gasUsedBins.length - firstNonZeroIndexFromEnd)
      .map((frequency, i) => [intervalWidth * (firstNonZeroIndex + i), frequency]);
  }

  async expectSuccess(sendTx: () => Promise<SentEthersLiquityTransaction<T>>): Promise<void> {
    const [retries, receipt] = await retryUpTo(1, sendTx);

    this.outOfGasFailures += retries;

    if (receipt.status !== "succeeded") {
      throw new EthersTransactionFailedError("Transaction failed", receipt);
    }

    this.addToGasUsedHisto(receipt.rawReceipt.gasUsed);
  }

  async expectFailure(waitForSuccess: () => Promise<T>): Promise<void> {
    try {
      await waitForSuccess();
    } catch {
      this.expectedFailures++;
      return;
    }

    throw new Error("Unexpected success");
  }
}
