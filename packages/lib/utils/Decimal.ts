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
    if (precision !== undefined) {
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

  isZero() {
    return this.bigNumber.isZero();
  }

  isInfinite() {
    return this.eq(Decimal.INFINITY);
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
}
