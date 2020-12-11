import { describe, it } from "mocha";
import fc from "fast-check";

import { StabilityDeposit } from "../src/StabilityDeposit";

const arbitraryDeposit = () =>
  fc
    .record({ initialLUSD: fc.float(), currentLUSD: fc.float(), collateralGain: fc.float() })
    .filter(({ initialLUSD, currentLUSD }) => initialLUSD >= currentLUSD)
    .map(depositish => new StabilityDeposit(depositish));

describe("StabilityDeposit", () => {
  it("applying b's diff from a to a should always yield b", () => {
    fc.assert(
      fc.property(arbitraryDeposit(), fc.float(), (a, b) => a.apply(a.whatChanged(b)).eq(b))
    );
  });
});
