import { describe, it } from "mocha";
import fc from "fast-check";

import { StabilityDeposit } from "../src/StabilityDeposit";

const arbitraryDeposit = () =>
  fc
    .record({ deposit: fc.float(), depositAfterLoss: fc.float(), pendingCollateralGain: fc.float() })
    .filter(({ deposit, depositAfterLoss }) => deposit >= depositAfterLoss)
    .map(depositish => new StabilityDeposit(depositish));

describe("StabilityDeposit", () => {
  it("applying b's diff from a to a should always yield b", () => {
    fc.assert(
      fc.property(arbitraryDeposit(), arbitraryDeposit(), (a, b) =>
        a.apply(a.calculateDifference(b)).depositAfterLoss.eq(b.depositAfterLoss)
      )
    );
  });
});
