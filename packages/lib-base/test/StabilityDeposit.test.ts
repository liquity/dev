import { describe, it } from "mocha";
import fc from "fast-check";

import { Decimal } from "../src/Decimal";
import { StabilityDeposit } from "../src/StabilityDeposit";

const arbitraryDeposit = () =>
  fc
    .tuple(fc.float(), fc.float(), fc.float(), fc.float())
    .filter(([initialLUSD, currentLUSD]) => initialLUSD >= currentLUSD)
    .map(
      ([a, b, c, d]) =>
        new StabilityDeposit(Decimal.from(a), Decimal.from(b), Decimal.from(c), Decimal.from(d), "")
    );

const nonZeroDeposit = () => arbitraryDeposit().filter(({ currentLUSD }) => !currentLUSD.isZero);

describe("StabilityDeposit", () => {
  it("applying diff of `b` from `a` to `a` should always yield `b`", () => {
    fc.assert(
      fc.property(arbitraryDeposit(), fc.float(), (a, b) => a.apply(a.whatChanged(b)).eq(b))
    );
  });

  it("applying what changed should preserve zeroing", () => {
    fc.assert(
      fc.property(arbitraryDeposit(), nonZeroDeposit(), (a, b) => a.apply(b.whatChanged(0)).eq(0))
    );
  });
});
