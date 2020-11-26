import { BigNumberish } from "@ethersproject/bignumber";
import { BlockTag } from "@ethersproject/abstract-provider";

type PromisesOf<T> = {
  [P in keyof T]: T[P] extends infer U | undefined ? U | Promise<U> : T[P] | Promise<T[P]>;
};

export type EthersTransactionOverrides = PromisesOf<{
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
}>;

export type EthersCallOverrides = PromisesOf<{
  blockTag?: BlockTag;
  from?: string;
}>;
