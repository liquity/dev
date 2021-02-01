import { BigNumberish } from "@ethersproject/bignumber";
import { BlockTag } from "@ethersproject/abstract-provider";

export type Promisable<T> = {
  [P in keyof T]: T[P] | Promise<T[P]>;
};

export type EthersTransactionOverrides = Partial<
  Promisable<{
    nonce: BigNumberish;
    gasLimit: BigNumberish;
    gasPrice: BigNumberish;
  }>
>;

export type EthersCallOverrides = Partial<
  Promisable<{
    blockTag: BlockTag;
    from: string;
  }>
>;
