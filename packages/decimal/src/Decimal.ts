import assert from "assert";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";

const MAX_UINT_256 = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

const TEN = BigNumber.from(10);
const getDigits = (numDigits: number) => TEN.pow(numDigits);

/** @public */
export type Decimalish = Decimal | number | string;

const stringRepresentationFormat = /^[0-9]*(\.[0-9]*)?(e[-+]?[0-9]+)?$/;
const trailingZeros = /0*$/;
const magnitudes = ["", "K", "M", "B", "T"];

const roundedMul = (x: BigNumber, y: BigNumber) =>
  x.mul(y).add(Decimal.HALF.bigNumber).div(Decimal.DIGITS);

/** @public */
export class Decimal {
  static readonly PRECISION = 18;
  static readonly DIGITS = getDigits(Decimal.PRECISION);

  static readonly INFINITY = new Decimal(MAX_UINT_256);
  static readonly ZERO = Decimal.from(0);
  static readonly HALF = Decimal.from(0.5);
  static readonly ONE = Decimal.from(1);

  readonly bigNumber: BigNumber;

  constructor(bigNumber: BigNumber) {
    if (bigNumber.lt(0)) {
      throw new Error("must not be negative");
    }

    this.bigNumber = bigNumber;
  }

  private static _fromString(representation: string): Decimal {
    if (!representation || !representation.match(stringRepresentationFormat)) {
      throw new Error("bad decimal format");
    }

    if (representation.includes("e")) {
      let [coefficient, exponent] = representation.split("e");

      if (exponent.startsWith("-")) {
        return new Decimal(
          Decimal._fromString(coefficient).bigNumber.div(TEN.pow(BigNumber.from(exponent.substr(1))))
        );
      }

      if (exponent.startsWith("+")) {
        exponent = exponent.substr(1);
      }

      return new Decimal(
        Decimal._fromString(coefficient).bigNumber.mul(TEN.pow(BigNumber.from(exponent)))
      );
    }

    if (!representation.includes(".")) {
      return new Decimal(BigNumber.from(representation).mul(Decimal.DIGITS));
    }

    let [characteristic, mantissa] = representation.split(".");

    if (mantissa.length < Decimal.PRECISION) {
      mantissa += "0".repeat(Decimal.PRECISION - mantissa.length);
    } else {
      mantissa = mantissa.substr(0, Decimal.PRECISION);
    }

    return new Decimal(
      BigNumber.from(characteristic || 0)
        .mul(Decimal.DIGITS)
        .add(mantissa)
    );
  }

  static from(decimalish: Decimalish) {
    switch (typeof decimalish) {
      case "object":
        return decimalish;
      case "string":
        return Decimal._fromString(decimalish);
      case "number":
        return Decimal._fromString(decimalish.toString());
    }
  }

  static bigNumberFrom(decimalish: Decimalish) {
    return Decimal.from(decimalish).bigNumber;
  }

  private _toStringWithAutomaticPrecision() {
    const characteristic = this.bigNumber.div(Decimal.DIGITS);
    const mantissa = this.bigNumber.mod(Decimal.DIGITS);

    if (mantissa.isZero()) {
      return characteristic.toString();
    } else {
      const paddedMantissa = mantissa.toString().padStart(Decimal.PRECISION, "0");
      const trimmedMantissa = paddedMantissa.replace(trailingZeros, "");
      return characteristic.toString() + "." + trimmedMantissa;
    }
  }

  private _roundUp(precision: number) {
    const halfDigit = getDigits(Decimal.PRECISION - 1 - precision).mul(5);
    return this.bigNumber.add(halfDigit);
  }

  private _toStringWithPrecision(precision: number) {
    if (precision < 0) {
      throw new Error("precision must not be negative");
    }

    const value = precision < Decimal.PRECISION ? this._roundUp(precision) : this.bigNumber;
    const characteristic = value.div(Decimal.DIGITS);
    const mantissa = value.mod(Decimal.DIGITS);

    if (precision === 0) {
      return characteristic.toString();
    } else {
      const paddedMantissa = mantissa.toString().padStart(Decimal.PRECISION, "0");
      const trimmedMantissa = paddedMantissa.substr(0, precision);
      return characteristic.toString() + "." + trimmedMantissa;
    }
  }

  toString(precision?: number) {
    if (this.infinite) {
      return "∞";
    } else if (precision !== undefined) {
      return this._toStringWithPrecision(precision);
    } else {
      return this._toStringWithAutomaticPrecision();
    }
  }

  prettify(precision: number = 2) {
    const [characteristic, mantissa] = this.toString(precision).split(".");
    const prettyCharacteristic = characteristic.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");

    return mantissa !== undefined ? prettyCharacteristic + "." + mantissa : prettyCharacteristic;
  }

  static prettify(bigNumberish: BigNumberish) {
    return new Decimal(BigNumber.from(bigNumberish).mul(Decimal.DIGITS)).prettify(0);
  }

  shorten() {
    const characteristicLength = this.toString(0).length;
    const magnitude = Math.min(Math.floor((characteristicLength - 1) / 3), magnitudes.length - 1);

    const precision = Math.max(3 * (magnitude + 1) - characteristicLength, 0);
    const normalized = this.div(new Decimal(getDigits(Decimal.PRECISION + 3 * magnitude)));

    return normalized.prettify(precision) + magnitudes[magnitude];
  }

  static shorten(bigNumber: BigNumber) {
    return new Decimal(bigNumber.mul(Decimal.DIGITS)).shorten();
  }

  add(addend: Decimalish) {
    return new Decimal(this.bigNumber.add(Decimal.from(addend).bigNumber));
  }

  sub(subtrahend: Decimalish) {
    return new Decimal(this.bigNumber.sub(Decimal.from(subtrahend).bigNumber));
  }

  mul(multiplier: Decimalish) {
    return new Decimal(this.bigNumber.mul(Decimal.from(multiplier).bigNumber).div(Decimal.DIGITS));
  }

  div(divider: Decimalish) {
    divider = Decimal.from(divider);

    if (divider.isZero) {
      return Decimal.INFINITY;
    }

    return new Decimal(this.bigNumber.mul(Decimal.DIGITS).div(divider.bigNumber));
  }

  mulDiv(multiplier: Decimalish, divider: Decimalish) {
    multiplier = Decimal.from(multiplier);
    divider = Decimal.from(divider);

    if (divider.isZero) {
      return Decimal.INFINITY;
    }

    return new Decimal(this.bigNumber.mul(multiplier.bigNumber).div(divider.bigNumber));
  }

  pow(exponent: number) {
    assert(Number.isInteger(exponent));
    assert(0 <= exponent && exponent <= 0xffffffff); // Ensure we're safe to use bitwise ops

    if (exponent === 0) {
      return Decimal.ONE;
    }

    if (exponent === 1) {
      return this;
    }

    let x = this.bigNumber;
    let y = Decimal.DIGITS;

    for (; exponent > 1; exponent >>>= 1) {
      if (exponent & 1) {
        y = roundedMul(x, y);
      }

      x = roundedMul(x, x);
    }

    return new Decimal(roundedMul(x, y));
  }

  get isZero() {
    return this.bigNumber.isZero();
  }

  get zero() {
    if (this.isZero) {
      return this;
    }
  }

  get nonZero() {
    if (!this.isZero) {
      return this;
    }
  }

  get infinite() {
    if (this.eq(Decimal.INFINITY)) {
      return this;
    }
  }

  get finite() {
    if (!this.eq(Decimal.INFINITY)) {
      return this;
    }
  }

  get absoluteValue() {
    return this;
  }

  lt(that: Decimalish) {
    return this.bigNumber.lt(Decimal.from(that).bigNumber);
  }

  eq(that: Decimalish) {
    return this.bigNumber.eq(Decimal.from(that).bigNumber);
  }

  gt(that: Decimalish) {
    return this.bigNumber.gt(Decimal.from(that).bigNumber);
  }

  gte(that: Decimalish) {
    return this.bigNumber.gte(Decimal.from(that).bigNumber);
  }

  lte(that: Decimalish) {
    return this.bigNumber.lte(Decimal.from(that).bigNumber);
  }

  static min(a: Decimalish, b: Decimalish) {
    a = Decimal.from(a);
    b = Decimal.from(b);

    return a.lt(b) ? a : b;
  }

  static max(a: Decimalish, b: Decimalish) {
    a = Decimal.from(a);
    b = Decimal.from(b);

    return a.gt(b) ? a : b;
  }
}

type DifferenceRepresentation = { sign: "" | "+" | "-"; absoluteValue: Decimal };

/** @alpha */
export class Difference {
  private _number?: DifferenceRepresentation;

  private constructor(number?: DifferenceRepresentation) {
    this._number = number;
  }

  static between(d1: Decimalish | undefined, d2: Decimalish | undefined) {
    if (d1 === undefined || d2 === undefined) {
      return new Difference(undefined);
    }

    d1 = Decimal.from(d1);
    d2 = Decimal.from(d2);

    if (d1.infinite && d2.infinite) {
      return new Difference(undefined);
    } else if (d1.infinite) {
      return new Difference({ sign: "+", absoluteValue: d1 });
    } else if (d2.infinite) {
      return new Difference({ sign: "-", absoluteValue: d2 });
    } else if (d1.gt(d2)) {
      return new Difference({ sign: "+", absoluteValue: Decimal.from(d1).sub(d2) });
    } else if (d2.gt(d1)) {
      return new Difference({ sign: "-", absoluteValue: Decimal.from(d2).sub(d1) });
    } else {
      return new Difference({ sign: "", absoluteValue: Decimal.ZERO });
    }
  }

  toString(precision?: number) {
    if (!this._number) {
      return "N/A";
    }

    return this._number.sign + this._number.absoluteValue.toString(precision);
  }

  prettify(precision?: number) {
    if (!this._number) {
      return this.toString();
    }

    return this._number.sign + this._number.absoluteValue.prettify(precision);
  }

  mul(multiplier: Decimalish) {
    return new Difference(
      this._number && {
        sign: this._number.sign,
        absoluteValue: this._number.absoluteValue.mul(multiplier)
      }
    );
  }

  get bigNumber() {
    return this._number?.sign === "-"
      ? this._number.absoluteValue.bigNumber.mul(-1)
      : this._number?.absoluteValue.bigNumber;
  }

  get nonZero() {
    return this._number?.absoluteValue.nonZero && this;
  }

  get positive() {
    return this._number?.sign === "+" ? this : undefined;
  }

  get negative() {
    return this._number?.sign === "-" ? this : undefined;
  }

  get absoluteValue() {
    return this._number?.absoluteValue;
  }

  get infinite() {
    return this._number?.absoluteValue.infinite && this;
  }

  get finite() {
    return this._number?.absoluteValue.finite && this;
  }
}

/** @alpha */
export class Percent<
  T extends {
    infinite?: T | undefined;
    absoluteValue?: A | undefined;
    mul?(hundred: 100): T;
    toString(precision?: number): string;
  },
  A extends {
    gte(n: string): boolean;
  }
> {
  private _percent: T;

  public constructor(ratio: T) {
    this._percent = ratio.infinite || (ratio.mul && ratio.mul(100)) || ratio;
  }

  nonZeroish(precision: number) {
    const zeroish = `0.${"0".repeat(precision)}5`;

    if (this._percent.absoluteValue?.gte(zeroish)) {
      return this;
    }
  }

  toString(precision: number) {
    return (
      this._percent.toString(precision) +
      (this._percent.absoluteValue && !this._percent.infinite ? "%" : "")
    );
  }

  prettify() {
    if (this._percent.absoluteValue?.gte("1000")) {
      return this.toString(0);
    } else if (this._percent.absoluteValue?.gte("10")) {
      return this.toString(1);
    } else {
      return this.toString(2);
    }
  }
}
