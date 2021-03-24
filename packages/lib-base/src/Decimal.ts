import assert from "assert";

import { BigNumber } from "@ethersproject/bignumber";

const getDigits = (numDigits: number) => TEN.pow(numDigits);

const MAX_UINT_256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const PRECISION = 18;
const ONE = BigNumber.from(1);
const TEN = BigNumber.from(10);
const DIGITS = getDigits(PRECISION);

const stringRepresentationFormat = /^[0-9]*(\.[0-9]*)?(e[-+]?[0-9]+)?$/;
const trailingZeros = /0*$/;
const magnitudes = ["", "K", "M", "B", "T"];

const roundedMul = (x: BigNumber, y: BigNumber) => x.mul(y).add(Decimal.HALF.hex).div(DIGITS);

/**
 * Types that can be converted into a Decimal.
 *
 * @public
 */
export type Decimalish = Decimal | number | string;

/**
 * Fixed-point decimal bignumber with 18 digits of precision.
 *
 * @remarks
 * Used by Liquity libraries to precisely represent native currency (e.g. Ether), LUSD and LQTY
 * amounts, as well as derived metrics like collateral ratios.
 *
 * @public
 */
export class Decimal {
  static readonly INFINITY = Decimal.fromBigNumberString(MAX_UINT_256);
  static readonly ZERO = Decimal.from(0);
  static readonly HALF = Decimal.from(0.5);
  static readonly ONE = Decimal.from(1);

  private readonly _bigNumber: BigNumber;

  /** @internal */
  get hex(): string {
    return this._bigNumber.toHexString();
  }

  /** @internal */
  get bigNumber(): string {
    return this._bigNumber.toString();
  }

  private constructor(bigNumber: BigNumber) {
    if (bigNumber.isNegative()) {
      throw new Error("negatives not supported by Decimal");
    }

    this._bigNumber = bigNumber;
  }

  static fromBigNumberString(bigNumberString: string): Decimal {
    return new Decimal(BigNumber.from(bigNumberString));
  }

  private static _fromString(representation: string): Decimal {
    if (!representation || !representation.match(stringRepresentationFormat)) {
      throw new Error(`bad decimal format: "${representation}"`);
    }

    if (representation.includes("e")) {
      // eslint-disable-next-line prefer-const
      let [coefficient, exponent] = representation.split("e");

      if (exponent.startsWith("-")) {
        return new Decimal(
          Decimal._fromString(coefficient)._bigNumber.div(
            TEN.pow(BigNumber.from(exponent.substr(1)))
          )
        );
      }

      if (exponent.startsWith("+")) {
        exponent = exponent.substr(1);
      }

      return new Decimal(
        Decimal._fromString(coefficient)._bigNumber.mul(TEN.pow(BigNumber.from(exponent)))
      );
    }

    if (!representation.includes(".")) {
      return new Decimal(BigNumber.from(representation).mul(DIGITS));
    }

    // eslint-disable-next-line prefer-const
    let [characteristic, mantissa] = representation.split(".");

    if (mantissa.length < PRECISION) {
      mantissa += "0".repeat(PRECISION - mantissa.length);
    } else {
      mantissa = mantissa.substr(0, PRECISION);
    }

    return new Decimal(
      BigNumber.from(characteristic || 0)
        .mul(DIGITS)
        .add(mantissa)
    );
  }

  static from(decimalish: Decimalish): Decimal {
    switch (typeof decimalish) {
      case "object":
        if (decimalish instanceof Decimal) {
          return decimalish;
        } else {
          throw new Error("invalid Decimalish value");
        }
      case "string":
        return Decimal._fromString(decimalish);
      case "number":
        return Decimal._fromString(decimalish.toString());
      default:
        throw new Error("invalid Decimalish value");
    }
  }

  private _toStringWithAutomaticPrecision() {
    const characteristic = this._bigNumber.div(DIGITS);
    const mantissa = this._bigNumber.mod(DIGITS);

    if (mantissa.isZero()) {
      return characteristic.toString();
    } else {
      const paddedMantissa = mantissa.toString().padStart(PRECISION, "0");
      const trimmedMantissa = paddedMantissa.replace(trailingZeros, "");
      return characteristic.toString() + "." + trimmedMantissa;
    }
  }

  private _roundUp(precision: number) {
    const halfDigit = getDigits(PRECISION - 1 - precision).mul(5);
    return this._bigNumber.add(halfDigit);
  }

  private _toStringWithPrecision(precision: number) {
    if (precision < 0) {
      throw new Error("precision must not be negative");
    }

    const value = precision < PRECISION ? this._roundUp(precision) : this._bigNumber;
    const characteristic = value.div(DIGITS);
    const mantissa = value.mod(DIGITS);

    if (precision === 0) {
      return characteristic.toString();
    } else {
      const paddedMantissa = mantissa.toString().padStart(PRECISION, "0");
      const trimmedMantissa = paddedMantissa.substr(0, precision);
      return characteristic.toString() + "." + trimmedMantissa;
    }
  }

  toString(precision?: number): string {
    if (this.infinite) {
      return "∞";
    } else if (precision !== undefined) {
      return this._toStringWithPrecision(precision);
    } else {
      return this._toStringWithAutomaticPrecision();
    }
  }

  prettify(precision = 2): string {
    const [characteristic, mantissa] = this.toString(precision).split(".");
    const prettyCharacteristic = characteristic.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");

    return mantissa !== undefined ? prettyCharacteristic + "." + mantissa : prettyCharacteristic;
  }

  shorten(): string {
    const characteristicLength = this.toString(0).length;
    const magnitude = Math.min(Math.floor((characteristicLength - 1) / 3), magnitudes.length - 1);

    const precision = Math.max(3 * (magnitude + 1) - characteristicLength, 0);
    const normalized = this.div(new Decimal(getDigits(PRECISION + 3 * magnitude)));

    return normalized.prettify(precision) + magnitudes[magnitude];
  }

  add(addend: Decimalish): Decimal {
    return new Decimal(this._bigNumber.add(Decimal.from(addend)._bigNumber));
  }

  sub(subtrahend: Decimalish): Decimal {
    return new Decimal(this._bigNumber.sub(Decimal.from(subtrahend)._bigNumber));
  }

  mul(multiplier: Decimalish): Decimal {
    return new Decimal(this._bigNumber.mul(Decimal.from(multiplier)._bigNumber).div(DIGITS));
  }

  div(divider: Decimalish): Decimal {
    divider = Decimal.from(divider);

    if (divider.isZero) {
      return Decimal.INFINITY;
    }

    return new Decimal(this._bigNumber.mul(DIGITS).div(divider._bigNumber));
  }

  /** @internal */
  _divCeil(divider: Decimalish): Decimal {
    divider = Decimal.from(divider);

    if (divider.isZero) {
      return Decimal.INFINITY;
    }

    return new Decimal(
      this._bigNumber.mul(DIGITS).add(divider._bigNumber.sub(ONE)).div(divider._bigNumber)
    );
  }

  mulDiv(multiplier: Decimalish, divider: Decimalish): Decimal {
    multiplier = Decimal.from(multiplier);
    divider = Decimal.from(divider);

    if (divider.isZero) {
      return Decimal.INFINITY;
    }

    return new Decimal(this._bigNumber.mul(multiplier._bigNumber).div(divider._bigNumber));
  }

  pow(exponent: number): Decimal {
    assert(Number.isInteger(exponent));
    assert(0 <= exponent && exponent <= 0xffffffff); // Ensure we're safe to use bitwise ops

    if (exponent === 0) {
      return Decimal.ONE;
    }

    if (exponent === 1) {
      return this;
    }

    let x = this._bigNumber;
    let y = DIGITS;

    for (; exponent > 1; exponent >>>= 1) {
      if (exponent & 1) {
        y = roundedMul(x, y);
      }

      x = roundedMul(x, x);
    }

    return new Decimal(roundedMul(x, y));
  }

  get isZero(): boolean {
    return this._bigNumber.isZero();
  }

  get zero(): this | undefined {
    if (this.isZero) {
      return this;
    }
  }

  get nonZero(): this | undefined {
    if (!this.isZero) {
      return this;
    }
  }

  get infinite(): this | undefined {
    if (this.eq(Decimal.INFINITY)) {
      return this;
    }
  }

  get finite(): this | undefined {
    if (!this.eq(Decimal.INFINITY)) {
      return this;
    }
  }

  /** @internal */
  get absoluteValue(): this {
    return this;
  }

  lt(that: Decimalish): boolean {
    return this._bigNumber.lt(Decimal.from(that)._bigNumber);
  }

  eq(that: Decimalish): boolean {
    return this._bigNumber.eq(Decimal.from(that)._bigNumber);
  }

  gt(that: Decimalish): boolean {
    return this._bigNumber.gt(Decimal.from(that)._bigNumber);
  }

  gte(that: Decimalish): boolean {
    return this._bigNumber.gte(Decimal.from(that)._bigNumber);
  }

  lte(that: Decimalish): boolean {
    return this._bigNumber.lte(Decimal.from(that)._bigNumber);
  }

  static min(a: Decimalish, b: Decimalish): Decimal {
    a = Decimal.from(a);
    b = Decimal.from(b);

    return a.lt(b) ? a : b;
  }

  static max(a: Decimalish, b: Decimalish): Decimal {
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

  static between(d1: Decimalish | undefined, d2: Decimalish | undefined): Difference {
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

  toString(precision?: number): string {
    if (!this._number) {
      return "N/A";
    }

    return this._number.sign + this._number.absoluteValue.toString(precision);
  }

  prettify(precision?: number): string {
    if (!this._number) {
      return this.toString();
    }

    return this._number.sign + this._number.absoluteValue.prettify(precision);
  }

  mul(multiplier: Decimalish): Difference {
    return new Difference(
      this._number && {
        sign: this._number.sign,
        absoluteValue: this._number.absoluteValue.mul(multiplier)
      }
    );
  }

  get nonZero(): this | undefined {
    return this._number?.absoluteValue.nonZero && this;
  }

  get positive(): this | undefined {
    return this._number?.sign === "+" ? this : undefined;
  }

  get negative(): this | undefined {
    return this._number?.sign === "-" ? this : undefined;
  }

  get absoluteValue(): Decimal | undefined {
    return this._number?.absoluteValue;
  }

  get infinite(): this | undefined {
    return this._number?.absoluteValue.infinite && this;
  }

  get finite(): this | undefined {
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

  nonZeroish(precision: number): this | undefined {
    const zeroish = `0.${"0".repeat(precision)}5`;

    if (this._percent.absoluteValue?.gte(zeroish)) {
      return this;
    }
  }

  toString(precision: number): string {
    return (
      this._percent.toString(precision) +
      (this._percent.absoluteValue && !this._percent.infinite ? "%" : "")
    );
  }

  prettify(): string {
    if (this._percent.absoluteValue?.gte("1000")) {
      return this.toString(0);
    } else if (this._percent.absoluteValue?.gte("10")) {
      return this.toString(1);
    } else {
      return this.toString(2);
    }
  }
}
