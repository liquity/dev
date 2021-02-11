import { describe, it } from "mocha";
import { expect } from "chai";
import fc from "fast-check";

import { Decimal, Difference } from "../src/Decimal";

describe("Decimal", () => {
  describe(".from()", () => {
    describe("when passing a string", () => {
      it("should throw if it's empty", () => {
        expect(() => Decimal.from("")).to.throw("bad decimal format");
      });

      it("should throw if it's non-numeric", () => {
        expect(() => Decimal.from("12O")).to.throw("bad decimal format");
      });

      it("should convert it if it has no decimal point", () => {
        expect(Decimal.from("123456789123456789123456789").bigNumber)
          //                                               |<----- 18 ----->|
          /********/ .to.equal("123456789123456789123456789000000000000000000");
      });

      it("should convert it if it has decimal point", () => {
        expect(Decimal.from("123456789123456789.123456789").bigNumber)
          //                                       |<----- 18 ----->|
          /*********/ .to.equal("123456789123456789123456789000000000");
      });

      it("should convert it if characteristic is missing", () => {
        expect(Decimal.from(".123456789").bigNumber)
          //                     |<----- 18 ----->|
          /*********/ .to.equal("123456789000000000");
      });

      it("should convert it if mantissa is missing", () => {
        expect(Decimal.from("123456789.").bigNumber)
          //                             |<----- 18 ----->|
          /********/ .to.equal("123456789000000000000000000");
      });

      it("should truncate if mantissa is too long", () => {
        expect(Decimal.from("1.123456789123456789123456789").bigNumber)
          //                      |<----- 18 ----->|
          /*********/ .to.equal("1123456789123456789");
      });

      describe("in scientific notation", () => {
        it("should convert it if exponent has no sign", () => {
          expect(Decimal.from("1.23456789e7").bigNumber)
            //                      |<-7->||<----- 18 ----->|
            /*********/ .to.equal("12345678900000000000000000");
        });

        it("should convert it if exponent has '+' sign", () => {
          expect(Decimal.from("1.23456789e+9").bigNumber)
            //                      |<- 9 ->||<----- 18 ----->|
            /*********/ .to.equal("1234567890000000000000000000");
        });

        it("should convert it if exponent has '-' sign", () => {
          expect(Decimal.from("123456789.123456789e-10").bigNumber)
            //                              |<- 8->|
            /*********/ .to.equal("12345678912345678");
        });
      });
    });

    describe("when passing a number", () => {
      it("should preserve fractional part", () => {
        expect(Decimal.from(1.23456789).bigNumber)
          //                     |<----- 18 ----->|
          /********/ .to.equal("1234567890000000000");
      });

      it("should convert it even if it's very small", () => {
        expect(Decimal.from(1e-15).bigNumber).to.equal("1000");
      });

      it("should convert it even if it's very large", () => {
        expect(Decimal.from(1e25).bigNumber)
          //          |<--------- 25 -------->||<----- 18 ----->|
          .to.equal("10000000000000000000000000000000000000000000");
      });
    });

    describe("when passing a Decimal", () => {
      it("should return the same Decimal", () => {
        const decimal = Decimal.from("123456789");
        expect(Decimal.from(decimal)).to.equal(decimal);
      });
    });
  });

  describe(".toString()", () => {
    describe("when not passing a parameter", () => {
      it("should not include '.' for integers", () => {
        expect(Decimal.fromBigNumberString("123456789000000000000000000").toString())
          //                                      |<----- 18 ----->|
          /*****************/ .to.equal("123456789");
      });

      it("should include '.' for fractions", () => {
        expect(Decimal.fromBigNumberString("123456789000000000123456789").toString())
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.000000000123456789");
      });

      it("should trim trailing zeros from fractions", () => {
        expect(Decimal.fromBigNumberString("123456789123456789000000000").toString())
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.123456789");
      });
    });

    describe("when passing a precision parameter", () => {
      it("should round to the nearest decimal", () => {
        expect(Decimal.fromBigNumberString("123456789000499999999999999").toString(3))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.000");

        expect(Decimal.fromBigNumberString("123456789000500000000000000").toString(3))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.001");
      });

      it("should include '.' and decimal zeros for integers if precision is >0", () => {
        expect(Decimal.fromBigNumberString("123456789000000000000000000").toString(2))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.00");
      });

      it("should not include '.' if precision is 0", () => {
        expect(Decimal.fromBigNumberString("123456789123456789123456789").toString(0))
          //                                      |<----- 18 ----->|
          /*****************/ .to.equal("123456789");
      });
    });
  });

  describe(".shorten()", () => {
    const cases = [
      ["0.123", "0.12"],
      ["1.234", "1.23"],
      ["12.345", "12.3"],
      ["123.456", "123"],
      ["1234.567", "1.23K"],
      ["12345.678", "12.3K"],
      ["123456.789", "123K"],
      ["1234567.891", "1.23M"],
      ["12345678.912", "12.3M"],
      ["123456789.123", "123M"],
      ["1234567891.234", "1.23B"],
      ["12345678912.345", "12.3B"],
      ["123456789123.456", "123B"],
      ["1234567891234.567", "1.23T"],
      ["12345678912345.678", "12.3T"],
      ["123456789123456.789", "123T"],
      ["1234567891234567.891", "1,235T"],
      ["12345678912345678.912", "12,346T"],
      ["123456789123456789.123", "123,457T"],
      ["1234567891234567891.234", "1,234,568T"]
    ];

    for (const [input, expectedOutput] of cases) {
      it(`should turn '${input}' into '${expectedOutput}'`, () => {
        expect(Decimal.from(input).shorten()).to.equal(expectedOutput);
      });
    }
  });

  describe(".mul()", () => {
    it("should multiply", () => {
      expect(Decimal.from(2).mul(3).toString()).to.equal("6");
    });
  });

  describe(".div()", () => {
    it("should divide", () => {
      expect(Decimal.from(3).div(2).toString()).to.equal("1.5");
    });
  });

  describe(".mulDiv()", () => {
    it("should multiply then divide", () => {
      expect(Decimal.from(2).mulDiv(3, 2).toString()).to.equal("3");
    });
  });

  describe(".pow()", () => {
    it("should be roughly the same as Math.pow()", () => {
      fc.assert(
        fc.property(
          fc.float(),
          fc.integer({ min: 0, max: 0xffffffff }),
          (x, y) =>
            !!Difference.between(Math.pow(x, y), Decimal.from(x).pow(y)).absoluteValue?.lt(1e-9)
        )
      );
    });
  });

  describe(".isZero", () => {
    it("should be true if Decimal is zero", () => {
      expect(Decimal.from("0.0").isZero).to.be.true;
    });

    it("should be false if Decimal is non-zero", () => {
      expect(Decimal.from("0.1").isZero).to.be.false;
    });
  });
});
