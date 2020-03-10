import assert from "assert";
import { BigNumber, bigNumberify } from "ethers/utils";

export type Decimalish = Decimal | number | string;

export class Decimal {
  static readonly INFINITY = new Decimal(
    bigNumberify(2)
      .pow(256)
      .sub(1)
  );

  static readonly PRECISION = 18;
  static readonly DIGITS = Decimal.getDigits(Decimal.PRECISION);

  private static readonly stringRepresentationFormat = /^[0-9]*(\.[0-9]*)?$/;
  private static readonly trailingZeros = /0*$/;
  private static readonly magnitudes = ["", "K", "M", "B", "T"];

  readonly bigNumber: BigNumber;

  constructor(bigNumber: BigNumber) {
    if (bigNumber.lt(0)) {
      throw new Error("must not be negative");
    }
    this.bigNumber = bigNumber;
  }

  private static getDigits(numDigits: number) {
    return bigNumberify(10).pow(numDigits);
  }

  private static fromString(representation: string) {
    if (!representation || !representation.match(Decimal.stringRepresentationFormat)) {
      throw new Error("bad decimal format");
    }

    if (representation.indexOf(".") < 0) {
      return new Decimal(bigNumberify(representation).mul(Decimal.DIGITS));
    }

    let [characteristic, mantissa] = representation.split(".");
    if (mantissa.length < Decimal.PRECISION) {
      mantissa += "0".repeat(Decimal.PRECISION - mantissa.length);
    } else {
      mantissa = mantissa.substr(0, Decimal.PRECISION);
    }

    return new Decimal(
      bigNumberify(characteristic)
        .mul(Decimal.DIGITS)
        .add(mantissa)
    );
  }

  static from(decimalish: Decimalish) {
    switch (typeof decimalish) {
      case "object":
        return decimalish;
      case "string":
        return Decimal.fromString(decimalish);
      case "number":
        return Decimal.fromString(decimalish.toString());
    }
  }

  static bigNumberFrom(decimalish: Decimalish) {
    return Decimal.from(decimalish).bigNumber;
  }

  private toStringWithAutomaticPrecision() {
    const characteristic = this.bigNumber.div(Decimal.DIGITS);
    const mantissa = this.bigNumber.mod(Decimal.DIGITS);

    if (mantissa.isZero()) {
      return characteristic.toString();
    } else {
      const paddedMantissa = mantissa.toString().padStart(Decimal.PRECISION, "0");
      const trimmedMantissa = paddedMantissa.replace(Decimal.trailingZeros, "");
      return characteristic.toString() + "." + trimmedMantissa;
    }
  }

  private roundUp(precision: number) {
    assert(precision < Decimal.PRECISION);
    const halfDigit = Decimal.getDigits(Decimal.PRECISION - 1 - precision).mul(5);
    return this.bigNumber.add(halfDigit);
  }

  private toStringWithPrecision(precision: number) {
    if (precision < 0) {
      throw new Error("precision must not be negative");
    }

    const value = precision < Decimal.PRECISION ? this.roundUp(precision) : this.bigNumber;
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
      return this.toStringWithPrecision(precision);
    } else {
      return this.toStringWithAutomaticPrecision();
    }
  }

  prettify(precision: number = 2) {
    const [characteristic, mantissa] = this.toString(precision).split(".");
    const prettyCharacteristic = characteristic.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");

    return mantissa !== undefined ? prettyCharacteristic + "." + mantissa : prettyCharacteristic;
  }

  shorten() {
    const characteristicLength = this.toString(0).length;
    const magnitude = Math.min(
      Math.floor((characteristicLength - 1) / 3),
      Decimal.magnitudes.length - 1
    );

    const precision = Math.max(3 * (magnitude + 1) - characteristicLength, 0);
    const normalized = this.div(new Decimal(Decimal.getDigits(Decimal.PRECISION + 3 * magnitude)));

    return normalized.prettify(precision) + Decimal.magnitudes[magnitude];
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
    return new Decimal(this.bigNumber.mul(Decimal.DIGITS).div(Decimal.from(divider).bigNumber));
  }

  mulDiv(multiplier: Decimalish, divider: Decimalish) {
    return new Decimal(
      this.bigNumber.mul(Decimal.from(multiplier).bigNumber).div(Decimal.from(divider).bigNumber)
    );
  }

  get isZero() {
    return this.bigNumber.isZero();
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
}

type DifferenceRepresentation = { sign: "" | "+" | "-"; absoluteValue: Decimal };

export class Difference {
  private number?: DifferenceRepresentation;

  private constructor(number?: DifferenceRepresentation) {
    this.number = number;
  }

  static between(d1: Decimalish, d2: Decimalish) {
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
      return new Difference({ sign: "", absoluteValue: Decimal.from(0) });
    }
  }

  toString(precision?: number) {
    if (!this.number) {
      return "N/A";
    }

    return this.number.sign + this.number.absoluteValue.toString(precision);
  }

  prettify(precision?: number) {
    if (!this.number) {
      return this.toString();
    }

    return this.number.sign + this.number.absoluteValue.prettify(precision);
  }

  mul(multiplier: Decimalish) {
    return new Difference(
      this.number && {
        sign: this.number.sign,
        absoluteValue: this.number.absoluteValue.mul(multiplier)
      }
    );
  }

  get nonZero() {
    return this.number?.absoluteValue.nonZero && this;
  }

  get positive() {
    return (this.number?.sign === "+" && this) || undefined;
  }

  get negative() {
    return (this.number?.sign === "-" && this) || undefined;
  }

  get absoluteValue() {
    return this.number?.absoluteValue;
  }

  get infinite() {
    return this.number?.absoluteValue.infinite && this;
  }
}

export class Percent<
  A extends {
    gte(n: string): boolean;
  },
  T extends {
    infinite: T | undefined;
    absoluteValue: A | undefined;
    mul(hundred: 100): T;
    toString(precision?: number): string;
  }
> {
  private percent: T;

  public constructor(ratio: T) {
    this.percent = ratio.infinite || ratio.mul(100);
  }

  nonZeroish(precision: number) {
    const zeroish = `0.${"0".repeat(precision)}5`;

    if (this.percent.absoluteValue?.gte(zeroish)) {
      return this;
    }
  }

  toString(precision: number) {
    return this.percent.infinite?.toString() || this.percent.toString(precision) + "%";
  }

  prettify() {
    if (this.percent.absoluteValue?.gte("1000")) {
      return this.toString(0);
    } else if (this.percent.absoluteValue?.gte("10")) {
      return this.toString(1);
    } else {
      return this.toString(2);
    }
  }
}
