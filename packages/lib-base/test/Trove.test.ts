import { describe, it } from "mocha";
import fc from "fast-check";

import { Trove } from "../src/Trove";

const arbitraryTrove = () =>
  fc.record({ collateral: fc.float(), debt: fc.float() }).map(trovish => new Trove(trovish));

describe("Trove", () => {
  it("applying b's diff from a to a should always yield b", () => {
    fc.assert(
      fc.property(arbitraryTrove(), arbitraryTrove(), (a, b) => a.apply(a.whatChanged(b)).equals(b))
    );
  });
});
