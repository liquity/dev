import { describe, it } from "mocha";
import fc from "fast-check";

import { LQTYStake } from "../src/LQTYStake";

const arbitraryStake = () =>
  fc
    .record({ stakedLQTY: fc.float(), collateralGain: fc.float(), lusdGain: fc.float() })
    .map(stakish => new LQTYStake(stakish));

const nonZeroStake = () => arbitraryStake().filter(({ stakedLQTY }) => !stakedLQTY.isZero);

describe("LQTYStake", () => {
  it("applying diff of `b` from `a` to `a` should always yield `b`", () => {
    fc.assert(fc.property(arbitraryStake(), fc.float(), (a, b) => a.apply(a.whatChanged(b)).eq(b)));
  });

  it("applying what changed should preserve zeroing", () => {
    fc.assert(
      fc.property(arbitraryStake(), nonZeroStake(), (a, b) => a.apply(b.whatChanged(0)).eq(0))
    );
  });
});
