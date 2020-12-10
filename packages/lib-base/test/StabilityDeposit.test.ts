import { describe, it } from "mocha";
import fc from "fast-check";

import { StabilityDeposit } from "../src/StabilityDeposit";

const arbitraryDeposit = () =>
  fc
    .record({ initial: fc.float(), current: fc.float(), collateralGain: fc.float() })
    .filter(({ initial, current }) => initial >= current)
    .map(depositish => new StabilityDeposit(depositish));

describe("StabilityDeposit", () => {
  it("applying b's diff from a to a should always yield b", () => {
    fc.assert(
      fc.property(arbitraryDeposit(), arbitraryDeposit(), (a, b) =>
        a.apply(a.calculateDifference(b)).current.eq(b.current)
      )
    );
  });
});
