import { BigNumberish } from "@ethersproject/bignumber";
import { BlockTag, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { PopulatedTransaction } from "@ethersproject/contracts";

export interface EthersTransactionOverrides {
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
}

export interface EthersCallOverrides {
  blockTag?: BlockTag;
  from?: string;
}

// These type aliases mostly for documentation (so we can point to the Ethers documentation).

/**
 * Alias of Ethers'
 * {@link https://docs.ethers.io/v5/api/providers/types/#providers-TransactionResponse | TransactionResponse}
 * type.
 *
 * @public
 */
export type EthersTransactionResponse = TransactionResponse;

/**
 * Alias of Ethers'
 * {@link https://docs.ethers.io/v5/api/providers/types/#providers-TransactionReceipt | TransactionReceipt}
 * type.
 *
 * @public
 */
export type EthersTransactionReceipt = TransactionReceipt;

/**
 * Alias of Ethers' PopulatedTransaction type, which implements
 * {@link https://docs.ethers.io/v5/api/utils/transactions/#UnsignedTransaction | UnsignedTransaction}.
 *
 * @public
 */
export type EthersPopulatedTransaction = PopulatedTransaction;
