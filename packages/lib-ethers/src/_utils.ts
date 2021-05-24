import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/lib-base";

export const numberify = (bigNumber: BigNumber): number => bigNumber.toNumber();

export const decimalify = (bigNumber: BigNumber): Decimal =>
  Decimal.fromBigNumberString(bigNumber.toHexString());

export const panic = <T>(e: unknown): T => {
  throw e;
};

export type Resolved<T> = T extends Promise<infer U> ? U : T;
export type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

export const promiseAllValues = <T>(object: T): Promise<ResolvedValues<T>> => {
  const keys = Object.keys(object);

  return Promise.all(Object.values(object)).then(values =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};
