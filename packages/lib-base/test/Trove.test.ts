import assert from "assert";
import { describe, it } from "mocha";
import fc from "fast-check";

import { Trove, emptyTrove } from "../src/Trove";

const arbitraryTrove = () =>
  fc
    .record({ collateral: fc.float(), debt: fc.float({ min: 10, max: 100 }) })
    .map(trovish => new Trove(trovish));

describe("Trove", () => {
  it("applying undefined diff should yield the same Trove", () => {
    const trove = new Trove({ collateral: 1, debt: 111 });

    assert(trove.apply(undefined) === trove);
  });

  it("applying diff of `b` from empty to `a` should always yield `a`", () => {
    fc.assert(
      fc.property(arbitraryTrove(), arbitraryTrove(), (a, b) =>
        a.apply(emptyTrove.whatChanged(b)).equals(a)
      )
    );
  });

  it("applying diff of empty from `b` to `a` should always yield empty", () => {
    fc.assert(
      fc.property(arbitraryTrove(), arbitraryTrove(), (a, b) =>
        a.apply(b.whatChanged(emptyTrove)).equals(emptyTrove)
      )
    );
  });

  it("applying diff of `b` from `a` to `a` should always yield `b`", () => {
    fc.assert(
      fc.property(arbitraryTrove(), arbitraryTrove(), (a, b) => a.apply(a.whatChanged(b)).equals(b))
    );
  });
});
