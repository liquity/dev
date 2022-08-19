import { constants } from "ethers";
import { CHICKEN_BOND_MANAGER_ADDRESS } from "@liquity/chicken-bonds/lusd/addresses";
import type { BLUSDToken, BondNFT, ChickenBondManager } from "@liquity/chicken-bonds/lusd/types";
import type { CurveCryptoSwap2ETH } from "@liquity/chicken-bonds/lusd/types/external";
import type {
  BondCreatedEventObject,
  BondCreatedEvent,
  BondCancelledEventObject,
  BondCancelledEvent,
  BondClaimedEventObject,
  BondClaimedEvent
} from "@liquity/chicken-bonds/lusd/types/ChickenBondManager";
import { Decimal } from "@liquity/lib-base";
import type { LUSDToken } from "@liquity/lib-ethers/dist/types";
import type { ProtocolInfo, Bond, BondStatus, Stats, Treasury } from "./transitions";
import { numberify, decimalify } from "../utils";

type Maybe<T> = T | undefined;

const BOND_STATUS: BondStatus[] = ["NON_EXISTENT", "PENDING", "CANCELLED", "CLAIMED"];

const getAccountBonds = async (
  account: string,
  bondNft: BondNFT,
  chickenBondManager: ChickenBondManager,
  marketPrice: Decimal,
  alphaAccrualFactor: Decimal,
  marketPricePremium: Decimal,
  claimBondFee: Decimal,
  floorPrice: Decimal
): Promise<Bond[]> => {
  console.log("getAccountBonds() started");
  const totalBonds = (await bondNft.balanceOf(account)).toNumber();

  console.log("getAccountBonds()", { totalBonds });

  const bondIdRequests = Array.from(Array(totalBonds)).map((_, index) =>
    bondNft.tokenOfOwnerByIndex(account, index)
  );
  const bondIds = await Promise.all(bondIdRequests);

  const bondRequests = {
    deposits: bondIds.map(bondId => bondNft.getBondAmount(bondId)),
    accrueds: bondIds.map(bondId => chickenBondManager.calcAccruedBLUSD(bondId)),
    startTimes: bondIds.map(bondId => bondNft.getBondStartTime(bondId)),
    endTimes: bondIds.map(bondId => bondNft.getBondEndTime(bondId)),
    statuses: bondIds.map(bondId => bondNft.getBondStatus(bondId)),
    tokenUris: bondIds.map(bondId => bondNft.tokenURI(bondId))
  };

  const bondDeposits = await Promise.all(bondRequests.deposits);
  const bondAccrueds = await Promise.all(bondRequests.accrueds);
  const bondStartTimes = await Promise.all(bondRequests.startTimes);
  const bondEndTimes = await Promise.all(bondRequests.endTimes);
  const bondStatuses = await Promise.all(bondRequests.statuses);
  const bondTokenUris = await Promise.all(bondRequests.tokenUris);

  console.log("getAccountBonds()", { bondIds });

  const bonds = bondIds
    .reduce<Bond[]>((accumulator, _, idx) => {
      const id = numberify(bondIds[idx]).toString();
      const deposit = decimalify(bondDeposits[idx]);
      const accrued = decimalify(bondAccrueds[idx]);
      const startTime = numberify(bondStartTimes[idx]);
      const endTime = numberify(bondEndTimes[idx]);
      const status = BOND_STATUS[bondStatuses[idx]];
      const tokenUri = bondTokenUris[idx];
      const rebondDays = getRebondDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
      const breakEvenDays = getBreakEvenDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
      const rebondAccrual = getFutureBLusdAccrualFactor(
        floorPrice,
        rebondDays,
        alphaAccrualFactor
      ).mul(deposit);
      const breakEvenAccrual = getFutureBLusdAccrualFactor(
        floorPrice,
        breakEvenDays,
        alphaAccrualFactor
      ).mul(deposit);

      const breakEvenTime = parseInt(getFutureTimeByDays(breakEvenDays).toString());
      const rebondTime = parseInt(getFutureTimeByDays(rebondDays).toString());
      const marketValue = decimalify(bondAccrueds[idx]).mul(marketPrice);

      return [
        ...accumulator,
        {
          id,
          deposit,
          accrued,
          startTime,
          endTime,
          status,
          tokenUri,
          breakEvenAccrual,
          rebondAccrual,
          breakEvenTime,
          rebondTime,
          marketValue,
          rebondReturn: Decimal.from(120) //Decimal.from(400).mul(stub.price).sub(decimalify(deposit)),
        }
      ];
    }, [])
    .sort((a, b) => (a.startTime > b.startTime ? -1 : a.startTime < b.startTime ? 1 : 0));
  console.log("getAccountBonds() finished");

  return bonds;
};

const getBreakEvenDays = (
  alphaAccrualFactor: Decimal,
  marketPricePremium: Decimal,
  claimBondFee: Decimal
): Decimal => {
  return alphaAccrualFactor.div(marketPricePremium.mul(Decimal.ONE.sub(claimBondFee)).sub(1));
};

const getFutureBLusdAccrualFactor = (
  floorPrice: Decimal,
  daysInFuture: Decimal,
  alphaAccrualFactor: Decimal,
  bondAgeInDays = Decimal.ZERO
): Decimal => {
  const duration = daysInFuture.sub(bondAgeInDays);
  return Decimal.ONE.div(floorPrice).mul(duration.div(duration.add(alphaAccrualFactor)));
};

const getRebondDays = (
  alphaAccrualFactor: Decimal,
  marketPricePremium: Decimal,
  claimBondFee: Decimal
): Decimal => {
  const sqrt = Decimal.from(
    Math.sqrt(parseFloat(Decimal.ONE.sub(claimBondFee).mul(marketPricePremium).toString()))
  );
  const dividend = Decimal.ONE.add(sqrt);
  const divisor = Decimal.ONE.sub(claimBondFee).mul(marketPricePremium).gt(1)
    ? Decimal.ONE.sub(claimBondFee).mul(marketPricePremium).sub(1)
    : Decimal.ONE;
  return alphaAccrualFactor.mul(dividend.div(divisor));
};

const daysToMilliseconds = (days: Decimal): Decimal => {
  return days.mul(24).mul(60).mul(60).mul(1000);
};

const getFutureTimeByDays = (days: Decimal): Decimal => {
  return Decimal.from(parseInt(daysToMilliseconds(days).add(Date.now()).toString()));
};

const getProtocolInfo = async (
  bLusdToken: BLUSDToken,
  bLusdAmm: CurveCryptoSwap2ETH,
  chickenBondManager: ChickenBondManager,
  reserveSize: Decimal
): Promise<ProtocolInfo> => {
  const bLusdSupply = decimalify(await bLusdToken.totalSupply());
  const marketPrice = decimalify(await bLusdAmm.price_oracle()).add(0.05); /* TODO REMOVE */
  const simulatedMarketPrice = marketPrice;
  const fairPrice = marketPrice.mul(1.1);
  const floorPrice = reserveSize.eq(0) ? Decimal.ONE : reserveSize.div(bLusdSupply);
  const claimBondFee = decimalify(await chickenBondManager.CHICKEN_IN_AMM_FEE());
  const alphaAccrualFactor = decimalify(await chickenBondManager.accrualParameter()).div(
    24 * 60 * 60
  );
  const marketPricePremium = marketPrice.div(floorPrice);
  const hasMarketPremium = marketPrice.gt(floorPrice.add(claimBondFee));
  console.log(
    `sim=${marketPrice.add(
      claimBondFee
    )}, marketPrice=${marketPrice}, floorPrice=${floorPrice}, alphaAccrualFactor=${alphaAccrualFactor}, claimBondFee=${claimBondFee}, marketPricePremium=${marketPricePremium}`
  );

  if (!hasMarketPremium) {
    const simulatedMarketPrice = marketPrice.add(claimBondFee);
    const simulatedMarketPricePremium = simulatedMarketPrice.div(floorPrice);
    const breakEvenDays = getBreakEvenDays(
      alphaAccrualFactor,
      simulatedMarketPricePremium,
      claimBondFee
    );
    const breakEvenTime = getFutureTimeByDays(breakEvenDays);
    const rebondDays = getRebondDays(alphaAccrualFactor, simulatedMarketPricePremium, claimBondFee);
    const rebondTime = getFutureTimeByDays(rebondDays);
    const breakEvenAccrualFactor = getFutureBLusdAccrualFactor(
      floorPrice,
      breakEvenDays,
      alphaAccrualFactor
    );
    const rebondAccrualFactor = getFutureBLusdAccrualFactor(
      floorPrice,
      rebondDays,
      alphaAccrualFactor
    );

    return {
      bLusdSupply,
      marketPrice,
      fairPrice,
      floorPrice,
      claimBondFee,
      alphaAccrualFactor,
      marketPricePremium,
      breakEvenTime,
      rebondTime,
      hasMarketPremium,
      simulatedMarketPrice,
      breakEvenAccrualFactor,
      rebondAccrualFactor
    };
  }

  const breakEvenDays = getBreakEvenDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
  const breakEvenTime = getFutureTimeByDays(breakEvenDays);
  const rebondDays = getRebondDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
  const rebondTime = getFutureTimeByDays(rebondDays);
  const breakEvenAccrualFactor = getFutureBLusdAccrualFactor(
    floorPrice,
    breakEvenDays,
    alphaAccrualFactor
  );
  const rebondAccrualFactor = getFutureBLusdAccrualFactor(
    floorPrice,
    rebondDays,
    alphaAccrualFactor
  );
  console.log(`breakEvenDays=${breakEvenDays}, rebondDays=${rebondDays}`);

  return {
    bLusdSupply,
    marketPrice,
    fairPrice,
    floorPrice,
    claimBondFee,
    alphaAccrualFactor,
    marketPricePremium,
    breakEvenTime,
    rebondTime,
    hasMarketPremium,
    simulatedMarketPrice,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenDays,
    rebondDays
  };
};

const getStats = async (bondNft: BondNFT): Promise<Stats> => {
  const totalBonds = decimalify(await bondNft.totalSupply()).mul(1e18);
  const totalBondsNumber = parseInt(totalBonds.toString());
  const bondIdRequests = Array.from(Array(totalBondsNumber)).map((_, index) =>
    bondNft.tokenByIndex(index)
  );
  const bondIds = await Promise.all(bondIdRequests);
  const bondStatuses = await Promise.all(bondIds.map(bondId => bondNft.getBondStatus(bondId)));
  const pendingBonds = Decimal.from(
    bondStatuses.filter(status => BOND_STATUS[status] === "PENDING").length
  );
  const cancelledBonds = Decimal.from(
    bondStatuses.filter(status => BOND_STATUS[status] === "CANCELLED").length
  );
  const claimedBonds = Decimal.from(
    bondStatuses.filter(status => BOND_STATUS[status] === "CLAIMED").length
  );

  return {
    pendingBonds,
    cancelledBonds,
    claimedBonds,
    totalBonds
  };
};

const getTreasury = async (chickenBondManager: ChickenBondManager): Promise<Treasury> => {
  const [pending, reserve, permanent] = await chickenBondManager.getTreasury();

  return {
    pending: decimalify(pending),
    reserve: decimalify(reserve),
    permanent: decimalify(permanent),
    total: decimalify(pending.add(reserve).add(permanent))
  };
};

const getTokenBalance = async (account: string, token: BLUSDToken | LUSDToken): Promise<Decimal> => {
  return decimalify(await token.balanceOf(account));
};

const isInfiniteBondApproved = async (account: string, lusdToken: LUSDToken): Promise<boolean> => {
  const allowance = await lusdToken.allowance(account, CHICKEN_BOND_MANAGER_ADDRESS);
  console.log({ allowance });

  // TODO: what is going on?.. weird quirk in forked mainnet version
  if (process.env.REACT_APP_DEMO_MODE === "true") {
    return allowance._hex === "0xfffffffffffffffffffffffffffffffffffffffffffffffa9438a1d29cefffff";
  }
  return allowance.eq(constants.MaxUint256);
};

const approveInfiniteBond = async (lusdToken: LUSDToken | undefined) => {
  if (lusdToken === undefined) throw new Error("approveInfiniteBond() failed: a dependency is null");
  console.log("approveInfiniteBond() started");
  try {
    await lusdToken.approve(CHICKEN_BOND_MANAGER_ADDRESS, constants.MaxUint256._hex);
    console.log("approveInfiniteBond() succceeded");
  } catch (error: unknown) {
    throw new Error(`approveInfiniteBond() failed: ${error}`);
  }
};

const createBond = async (
  lusdAmount: Decimal,
  chickenBondManager: ChickenBondManager | undefined
): Promise<BondCreatedEventObject> => {
  if (chickenBondManager === undefined) throw new Error("createBond() failed: a dependency is null");
  const receipt = await (await chickenBondManager.createBond(lusdAmount.hex)).wait();
  const createdEvent = receipt?.events?.find(
    e => e.event === "BondCreated"
  ) as Maybe<BondCreatedEvent>;

  if (createdEvent === undefined) {
    throw new Error("createBond() failed: couldn't find BondCreated event");
  }

  console.log("createBond() finished:", createdEvent.args);
  return createdEvent.args;
};

const cancelBond = async (
  bondId: string,
  minimumLusd: Decimal,
  chickenBondManager: ChickenBondManager | undefined
): Promise<BondCancelledEventObject> => {
  if (chickenBondManager === undefined) throw new Error("cancelBond() failed: a dependency is null");
  console.log("cancelBond() started:", bondId, minimumLusd.toString());
  const receipt = await (await chickenBondManager.chickenOut(bondId, minimumLusd.hex)).wait();
  const cancelledEvent = receipt?.events?.find(
    e => e.event === "BondCancelled"
  ) as Maybe<BondCancelledEvent>;

  if (cancelledEvent === undefined) {
    throw new Error("cancelBond() failed: couldn't find BondCancelled event");
  }
  console.log("cancelBond() finished:", cancelledEvent.args);
  return cancelledEvent.args;
};

const claimBond = async (
  bondId: string,
  chickenBondManager: ChickenBondManager | undefined
): Promise<BondClaimedEventObject> => {
  try {
    if (chickenBondManager === undefined)
      throw new Error("claimBond() failed: a dependency is null");
    console.log("claimBond() started", bondId);
    const receipt = await (await chickenBondManager.chickenIn(bondId)).wait();
    const bondClaimedEvent = receipt.events?.find(
      e => e.event === "BondClaimed"
    ) as Maybe<BondClaimedEvent>;

    if (bondClaimedEvent === undefined) {
      throw new Error("claimBond() failed: couldn't find BondClaimed event");
    }

    console.log("claimBond() finished", bondClaimedEvent.args);
    return bondClaimedEvent.args;
  } catch (error: unknown) {
    console.error("claimBond() failed:", error);
    throw error;
  }
};

export const api = {
  getAccountBonds,
  getStats,
  getTreasury,
  getTokenBalance,
  getProtocolInfo,
  getFutureBLusdAccrualFactor,
  approveInfiniteBond,
  isInfiniteBondApproved,
  createBond,
  cancelBond,
  claimBond
};
