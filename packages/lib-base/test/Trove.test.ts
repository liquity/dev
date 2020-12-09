import assert from "assert";
import { describe, it } from "mocha";
import fc from "fast-check";

import { Trove, Trovish, emptyTrove } from "../src/Trove";

const trove = (t: Trovish) => new Trove(t);

const onlyCollateral = () => fc.record({ collateral: fc.float({ min: 0.1 }) }).map(trove);

const onlyDebt = () => fc.record({ debt: fc.float({ min: 10, max: 100 }) }).map(trove);

const bothCollateralAndDebt = () =>
  fc
    .record({ collateral: fc.float({ min: 0.1 }), debt: fc.float({ min: 10, max: 100 }) })
    .map(trove);

const arbitraryTrove = () =>
  fc.record({ collateral: fc.float(), debt: fc.float({ max: 100 }) }).map(trove);

const validTrove = () =>
  fc.record({ collateral: fc.float(), debt: fc.float({ min: 10, max: 100 }) }).map(trove);

const validNonEmptyTrove = () => validTrove().filter(t => !t.isEmpty);

describe("Trove", () => {
  it("applying undefined diff should yield the same Trove", () => {
    const trove = new Trove({ collateral: 1, debt: 111 });

    assert(trove.apply(undefined) === trove);
  });

  it("applying diff of empty from `b` to `a` should always yield empty", () => {
    fc.assert(
      fc.property(arbitraryTrove(), validTrove(), (a, b) =>
        a.apply(b.whatChanged(emptyTrove)).equals(emptyTrove)
      )
    );
  });

  it("applying what changed should preserve zeroings", () => {
    fc.assert(
      fc.property(
        arbitraryTrove(),
        bothCollateralAndDebt(),
        onlyCollateral(),
        (a, b, c) => a.apply(b.whatChanged(c)).debt.isZero
      )
    );

    fc.assert(
      fc.property(
        arbitraryTrove(),
        bothCollateralAndDebt(),
        onlyDebt(),
        (a, b, c) => a.apply(b.whatChanged(c)).collateral.isZero
      )
    );
  });

  it("applying diff of `b` from `a` to `a` should always yield `b`", () => {
    fc.assert(
      fc.property(validTrove(), arbitraryTrove(), (a, b) => a.apply(a.whatChanged(b)).equals(b))
    );
  });

  it("applying an adjustment should never throw", () => {
    fc.assert(
      fc.property(validNonEmptyTrove(), validNonEmptyTrove(), validNonEmptyTrove(), (a, b, c) => {
        a.apply(b.whatChanged(c));
      })
    );
  });

  describe("whatChanged()", () => {
    it("should not define zeros on adjustment", () => {
      fc.assert(
        fc.property(validNonEmptyTrove(), validNonEmptyTrove(), (a, b) => {
          const change = a.whatChanged(b);

          return (
            change === undefined ||
            (change.type === "adjustment" &&
              !change.params.depositCollateral?.isZero &&
              !change.params.withdrawCollateral?.isZero &&
              !change.params.borrowLUSD?.isZero &&
              !change.params.repayLUSD?.isZero)
          );
        })
      );
    });
  });
});
