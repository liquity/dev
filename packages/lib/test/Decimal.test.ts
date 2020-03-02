import { describe, it } from "mocha";
import chai, { expect } from "chai";
import { bigNumberify } from "ethers/utils";
import { solidity } from "ethereum-waffle";

import { Decimal } from "../utils";

// want assertions on BigNumbers
chai.use(solidity);

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
          //                                            |<----- 18 ----->|
          /*****/ .to.equal("123456789123456789123456789000000000000000000");
      });

      it("should convert it if it has decimal point", () => {
        expect(Decimal.from("123456789123456789.123456789").bigNumber)
          //                                    |<----- 18 ----->|
          /******/ .to.equal("123456789123456789123456789000000000");
      });

      it("should convert it if characteristic is missing", () => {
        expect(Decimal.from(".123456789").bigNumber)
          //                  |<----- 18 ----->|
          /******/ .to.equal("123456789000000000");
      });

      it("should convert it if mantissa is missing", () => {
        expect(Decimal.from("123456789.").bigNumber)
          //                          |<----- 18 ----->|
          /*****/ .to.equal("123456789000000000000000000");
      });

      it("should truncate if mantissa is too long", () => {
        expect(Decimal.from("1.123456789123456789123456789").bigNumber)
          //                   |<----- 18 ----->|
          /******/ .to.equal("1123456789123456789");
      });
    });

    describe("when passing a number", () => {
      it("should preserve fractional part", () => {
        expect(Decimal.from(1.23456789).bigNumber)
          //                  |<----- 18 ----->|
          /*****/ .to.equal("1234567890000000000");
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
        expect(new Decimal(bigNumberify("123456789000000000000000000")).toString())
          //                                      |<----- 18 ----->|
          /*****************/ .to.equal("123456789");
      });

      it("should include '.' for fractions", () => {
        expect(new Decimal(bigNumberify("123456789000000000123456789")).toString())
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.000000000123456789");
      });

      it("should trim trailing zeros from fractions", () => {
        expect(new Decimal(bigNumberify("123456789123456789000000000")).toString())
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.123456789");
      });
    });

    describe("when passing a precision parameter", () => {
      it("should round to the nearest decimal", () => {
        expect(new Decimal(bigNumberify("123456789000499999999999999")).toString(3))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.000");

        expect(new Decimal(bigNumberify("123456789000500000000000000")).toString(3))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.001");
      });

      it("should include '.' and decimal zeros for integers if precision is >0", () => {
        expect(new Decimal(bigNumberify("123456789000000000000000000")).toString(2))
          //                                      |<----- 18 ----->|
          /****************/ .to.equal("123456789.00");
      });

      it("should not include '.' if precision is 0", () => {
        expect(new Decimal(bigNumberify("123456789123456789123456789")).toString(0))
          //                                      |<----- 18 ----->|
          /*****************/ .to.equal("123456789");
      });
    });
  });

  describe(".mul()", () => {
    it("should multiply", () => {
      expect(
        Decimal.from(2)
          .mul(3)
          .toString()
      ).to.equal("6");
    });
  });

  describe(".div()", () => {
    it("should divide", () => {
      expect(
        Decimal.from(3)
          .div(2)
          .toString()
      ).to.equal("1.5");
    });
  });

  describe(".mulDiv()", () => {
    it("should multiply then divide", () => {
      expect(
        Decimal.from(2)
          .mulDiv(3, 2)
          .toString()
      ).to.equal("3");
    });
  });

  describe(".isZero()", () => {
    it("should be true if Decimal is zero", () => {
      expect(Decimal.from("0.0").isZero()).to.be.true;
    });

    it("should be false if Decimal is non-zero", () => {
      expect(Decimal.from("0.1").isZero()).to.be.false;
    });
  });
});
