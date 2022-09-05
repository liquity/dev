import { constants } from "ethers";
import {
  CHICKEN_BOND_MANAGER_ADDRESS,
  BLUSD_AMM_ADDRESS
} from "@liquity/chicken-bonds/lusd/addresses";
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
import {
  numberify,
  decimalify,
  getBondAgeInDays,
  milliseconds,
  toFloat,
  getReturn,
  getTokenUri,
  getBreakEvenDays,
  getFutureBLusdAccrualFactor,
  getFutureDateByDays,
  getRebondDays
} from "../utils";
import { UNKNOWN_DATE } from "../../HorizontalTimeline";
import { BLusdAmmTokenIndex } from "./transitions";
import {
  TokenExchangeEvent,
  TokenExchangeEventObject
} from "@liquity/chicken-bonds/lusd/types/external/CurveCryptoSwap2ETH";

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
  const totalBonds = (await bondNft.balanceOf(account)).toNumber();

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

  const bonds = bondIds
    .reduce<Bond[]>((accumulator, _, idx) => {
      const id = numberify(bondIds[idx]).toString();
      const deposit = decimalify(bondDeposits[idx]);
      const accrued = decimalify(bondAccrueds[idx]);
      const startTime = milliseconds(numberify(bondStartTimes[idx]));
      const endTime = milliseconds(numberify(bondEndTimes[idx]));
      const status = BOND_STATUS[bondStatuses[idx]];
      const tokenUri = getTokenUri(bondTokenUris[idx]);
      const bondAgeInDays = getBondAgeInDays(startTime);
      const rebondDays = getRebondDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
      const breakEvenDays = getBreakEvenDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
      const rebondAccrual =
        rebondDays === Decimal.INFINITY
          ? Decimal.INFINITY
          : getFutureBLusdAccrualFactor(floorPrice, rebondDays, alphaAccrualFactor).mul(deposit);
      const breakEvenAccrual =
        breakEvenDays === Decimal.INFINITY
          ? Decimal.INFINITY
          : getFutureBLusdAccrualFactor(floorPrice, breakEvenDays, alphaAccrualFactor).mul(deposit);

      const breakEvenTime =
        breakEvenDays === Decimal.INFINITY
          ? UNKNOWN_DATE
          : getFutureDateByDays(toFloat(breakEvenDays) - bondAgeInDays);
      const rebondTime =
        breakEvenDays === Decimal.INFINITY
          ? UNKNOWN_DATE
          : getFutureDateByDays(toFloat(rebondDays) - bondAgeInDays);
      const marketValue = decimalify(bondAccrueds[idx]).mul(marketPrice);

      // Accrued bLUSD is 0 for cancelled/claimed bonds
      const claimNowReturn = accrued.isZero ? 0 : getReturn(accrued, deposit, marketPrice);
      const rebondReturn = accrued.isZero ? 0 : getReturn(rebondAccrual, deposit, marketPrice);
      const rebondRoi = rebondReturn / toFloat(deposit);

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
          rebondReturn,
          claimNowReturn,
          rebondRoi
        }
      ];
    }, [])
    .sort((a, b) => (a.startTime > b.startTime ? -1 : a.startTime < b.startTime ? 1 : 0));

  return bonds;
};

export const _getProtocolInfo = (
  marketPrice: Decimal,
  floorPrice: Decimal,
  claimBondFee: Decimal,
  alphaAccrualFactor: Decimal
) => {
  const marketPricePremium = marketPrice.div(floorPrice);
  const hasMarketPremium = marketPrice.gt(floorPrice.add(claimBondFee));

  const breakEvenDays = getBreakEvenDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
  const breakEvenTime = getFutureDateByDays(toFloat(breakEvenDays));
  const rebondDays = getRebondDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
  const rebondTime = getFutureDateByDays(toFloat(rebondDays));
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
    marketPricePremium,
    breakEvenTime,
    rebondTime,
    hasMarketPremium,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenDays,
    rebondDays
  };
};

const getProtocolInfo = async (
  bLusdToken: BLUSDToken,
  bLusdAmm: CurveCryptoSwap2ETH,
  chickenBondManager: ChickenBondManager,
  reserveSize: Decimal
): Promise<ProtocolInfo> => {
  const bLusdSupply = decimalify(await bLusdToken.totalSupply());
  const marketPrice = Decimal.ONE.div(decimalify(await bLusdAmm.price_oracle()));
  const fairPrice = marketPrice.mul(1.1); /* TODO: use real formula */
  const floorPrice = reserveSize.eq(0) ? Decimal.ONE : reserveSize.div(bLusdSupply);
  const claimBondFee = decimalify(await chickenBondManager.CHICKEN_IN_AMM_FEE());
  const alphaAccrualFactor = decimalify(await chickenBondManager.accrualParameter()).div(
    24 * 60 * 60
  );
  const {
    marketPricePremium,
    breakEvenTime,
    rebondTime,
    hasMarketPremium,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenDays,
    rebondDays
  } = _getProtocolInfo(marketPrice, floorPrice, claimBondFee, alphaAccrualFactor);

  const simulatedMarketPrice = hasMarketPremium ? marketPrice : floorPrice.mul(1.1);

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
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenDays,
    rebondDays,
    simulatedMarketPrice
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

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const approveInfiniteBond = async (lusdToken: LUSDToken | undefined): Promise<void> => {
  if (lusdToken === undefined) throw new Error("approveInfiniteBond() failed: a dependency is null");
  console.log("approveInfiniteBond() started");
  try {
    await (await lusdToken.approve(CHICKEN_BOND_MANAGER_ADDRESS, constants.MaxUint256._hex)).wait();
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

const isTokenApprovedWithBLusdAmm = async (
  account: string,
  token: LUSDToken | BLUSDToken
): Promise<boolean> => {
  const allowance = await token.allowance(account, BLUSD_AMM_ADDRESS);

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const approveTokenWithBLusdAmm = async (token: LUSDToken | BLUSDToken | undefined) => {
  if (token === undefined) {
    throw new Error("approveTokenWithBLusdAmm() failed: a dependency is null");
  }

  await (await token.approve(BLUSD_AMM_ADDRESS, constants.MaxUint256)).wait();
  return;
};

const getOtherToken = (thisToken: BLusdAmmTokenIndex) =>
  thisToken === BLusdAmmTokenIndex.BLUSD ? BLusdAmmTokenIndex.LUSD : BLusdAmmTokenIndex.BLUSD;

const getExpectedSwapOutput = async (
  inputToken: BLusdAmmTokenIndex,
  inputAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH
): Promise<Decimal> =>
  decimalify(await bLusdAmm.get_dy(inputToken, getOtherToken(inputToken), inputAmount.hex));

const swapTokens = async (
  inputToken: BLusdAmmTokenIndex,
  inputAmount: Decimal,
  minOutputAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<TokenExchangeEventObject> => {
  if (bLusdAmm === undefined) throw new Error("swapTokens() failed: a dependency is null");

  const receipt = await (
    await bLusdAmm["exchange(uint256,uint256,uint256,uint256)"](
      inputToken,
      getOtherToken(inputToken),
      inputAmount.hex,
      minOutputAmount.hex
    )
  ).wait();

  const exchangeEvent = receipt?.events?.find(
    e => e.event === "TokenExchange"
  ) as Maybe<TokenExchangeEvent>;

  if (exchangeEvent === undefined) {
    throw new Error("swapTokens() failed: couldn't find TokenExchange event");
  }

  console.log("swapTokens() finished:", exchangeEvent.args);
  return exchangeEvent.args;
};

export type BondsApi = {
  getAccountBonds: (
    account: string,
    bondNft: BondNFT,
    chickenBondManager: ChickenBondManager,
    marketPrice: Decimal,
    alphaAccrualFactor: Decimal,
    marketPricePremium: Decimal,
    claimBondFee: Decimal,
    floorPrice: Decimal
  ) => Promise<Bond[]>;
  getStats: (bondNft: BondNFT) => Promise<Stats>;
  getTreasury: (chickenBondManager: ChickenBondManager) => Promise<Treasury>;
  getTokenBalance: (account: string, token: BLUSDToken | LUSDToken) => Promise<Decimal>;
  getProtocolInfo: (
    bLusdToken: BLUSDToken,
    bLusdAmm: CurveCryptoSwap2ETH,
    chickenBondManager: ChickenBondManager,
    reserveSize: Decimal
  ) => Promise<ProtocolInfo>;
  approveInfiniteBond: (lusdToken: LUSDToken | undefined) => Promise<void>;
  isInfiniteBondApproved: (account: string, lusdToken: LUSDToken) => Promise<boolean>;
  isTokenApprovedWithBLusdAmm: (account: string, token: LUSDToken | BLUSDToken) => Promise<boolean>;
  approveTokenWithBLusdAmm: (token: LUSDToken | BLUSDToken | undefined) => Promise<void>;
  getExpectedSwapOutput: (
    inputToken: BLusdAmmTokenIndex,
    inputAmount: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH
  ) => Promise<Decimal>;
  swapTokens: (
    inputToken: BLusdAmmTokenIndex,
    inputAmount: Decimal,
    minOutputAmount: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH | undefined
  ) => Promise<TokenExchangeEventObject>;
  createBond: (
    lusdAmount: Decimal,
    chickenBondManager: ChickenBondManager | undefined
  ) => Promise<BondCreatedEventObject>;
  cancelBond: (
    bondId: string,
    minimumLusd: Decimal,
    chickenBondManager: ChickenBondManager | undefined
  ) => Promise<BondCancelledEventObject>;
  claimBond: (
    bondId: string,
    chickenBondManager: ChickenBondManager | undefined
  ) => Promise<BondClaimedEventObject>;
};

export const api: BondsApi = {
  getAccountBonds,
  getStats,
  getTreasury,
  getTokenBalance,
  getProtocolInfo,
  approveInfiniteBond,
  isInfiniteBondApproved,
  createBond,
  cancelBond,
  claimBond,
  isTokenApprovedWithBLusdAmm,
  approveTokenWithBLusdAmm,
  getExpectedSwapOutput,
  swapTokens
};
