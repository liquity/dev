import assert from "assert";
import { describe, it } from "mocha";
import fc from "fast-check";

import {
  LUSD_LIQUIDATION_RESERVE,
  LUSD_MINIMUM_DEBT,
  MAXIMUM_BORROWING_RATE
} from "../src/constants";

import { Decimal, Difference } from "../src/Decimal";
import { Trove, _emptyTrove } from "../src/Trove";

const liquidationReserve = Number(LUSD_LIQUIDATION_RESERVE);
const maximumBorrowingRate = Number(MAXIMUM_BORROWING_RATE);

const maxDebt = 10 * Number(LUSD_MINIMUM_DEBT);

const trove = ({ collateral = 0, debt = 0 }) =>
  new Trove(Decimal.from(collateral), Decimal.from(debt));

const onlyCollateral = () => fc.record({ collateral: fc.float({ min: 0.1 }) }).map(trove);

const onlyDebt = () =>
  fc.record({ debt: fc.float({ min: liquidationReserve, max: maxDebt }) }).map(trove);

const bothCollateralAndDebt = () =>
  fc
    .record({
      collateral: fc.float({ min: 0.1 }),
      debt: fc.float({ min: liquidationReserve, max: maxDebt })
    })
    .map(trove);

const arbitraryTrove = () => fc.record({ collateral: fc.float(), debt: fc.float() }).map(trove);

const validTrove = () =>
  fc
    .record({ collateral: fc.float(), debt: fc.float({ min: liquidationReserve, max: maxDebt }) })
    .map(trove);

const validNonEmptyTrove = () => validTrove().filter(t => !t.isEmpty);

const roughlyEqual = (a: Trove, b: Trove) =>
  a.collateral.eq(b.collateral) && !!Difference.between(a.debt, b.debt).absoluteValue?.lt(1e-9);

describe("Trove", () => {
  it("applying undefined diff should yield the same Trove", () => {
    const trove = new Trove(Decimal.from(1), Decimal.from(111));

    assert(trove.apply(undefined) === trove);
  });

  it("applying diff of empty from `b` to `a` should yield empty", () => {
    fc.assert(
      fc.property(validNonEmptyTrove(), validNonEmptyTrove(), (a, b) =>
        a.apply(b.whatChanged(_emptyTrove)).equals(_emptyTrove)
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

  it("applying diff of `b` from `a` to `a` should yield `b` when borrowing rate is 0", () => {
    fc.assert(
      fc.property(validTrove(), arbitraryTrove(), (a, b) =>
        a.apply(a.whatChanged(b, 0), 0).equals(b)
      )
    );
  });

  it("applying diff of `b` from `a` to `a` should roughly yield `b` when borrowing rate is non-0", () => {
    fc.assert(
      fc.property(validTrove(), arbitraryTrove(), fc.float({ max: 0.5 }), (a, b, c) =>
        roughlyEqual(a.apply(a.whatChanged(b, c), c), b)
      )
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

    it("should recreate a Trove with minimum debt at any borrowing rate", () => {
      fc.assert(
        fc.property(fc.float({ max: maximumBorrowingRate }), borrowingRate => {
          const withMinimumDebt = Trove.recreate(
            new Trove(Decimal.ONE, LUSD_MINIMUM_DEBT),
            borrowingRate
          );

          const ret = Trove.create(withMinimumDebt, borrowingRate).debt.gte(LUSD_MINIMUM_DEBT);

          if (!ret) {
            console.log(`${Trove.create(withMinimumDebt, borrowingRate).debt}`);
          }

          return ret;
        })
      );
    });
  });
});
