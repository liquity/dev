import { describe, it } from "mocha";
import fc from "fast-check";

import { StabilityDeposit } from "../src/StabilityDeposit";

const arbitraryDeposit = () =>
  fc
    .record({
      initialLUSD: fc.float(),
      currentLUSD: fc.float(),
      collateralGain: fc.float(),
      lqtyReward: fc.float()
    })
    .filter(({ initialLUSD, currentLUSD }) => initialLUSD >= currentLUSD)
    .map(depositish => new StabilityDeposit(depositish));

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
