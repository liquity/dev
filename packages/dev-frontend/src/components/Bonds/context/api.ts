import { BigNumber, CallOverrides, constants } from "ethers";
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
import { BLusdAmmTokenIndex } from "./transitions";
import { numberify, decimalify, getBondAgeInDays, milliseconds, toFloat, getReturn } from "../utils";
import {
  AddLiquidityEvent,
  AddLiquidityEventObject,
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
      const tokenUri = bondTokenUris[idx];
      const bondAgeInDays = getBondAgeInDays(startTime);
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

      const breakEvenTime = getFutureTimeByDays(toFloat(breakEvenDays) - bondAgeInDays);
      const rebondTime = getFutureTimeByDays(toFloat(rebondDays) - bondAgeInDays);
      const marketValue = decimalify(bondAccrueds[idx]).mul(marketPrice);
      const claimNowReturn = getReturn(accrued, deposit, marketPrice);
      const rebondReturn = getReturn(rebondAccrual, deposit, marketPrice);
      const rebondRoi = Decimal.from(rebondReturn).div(deposit);

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

const daysToMilliseconds = (days: number): number => {
  return days * 24 * 60 * 60 * 1000;
};

const getFutureTimeByDays = (days: number): number => {
  return Math.round(Date.now() + daysToMilliseconds(days));
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
  const breakEvenTime = getFutureTimeByDays(toFloat(breakEvenDays));
  const rebondDays = getRebondDays(alphaAccrualFactor, marketPricePremium, claimBondFee);
  const rebondTime = getFutureTimeByDays(toFloat(rebondDays));
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
    rebondDays,
    simulatedMarketPrice: marketPrice
  };
};

const getProtocolInfo = async (
  bLusdToken: BLUSDToken,
  bLusdAmm: CurveCryptoSwap2ETH,
  chickenBondManager: ChickenBondManager,
  reserveSize: Decimal
): Promise<ProtocolInfo> => {
  const bLusdSupply = decimalify(await bLusdToken.totalSupply());
  const marketPrice = decimalify(await bLusdAmm.price_oracle()).add(0.05); /* TODO REMOVE */
  const fairPrice = marketPrice.mul(1.1);
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
    rebondDays,
    simulatedMarketPrice
  } = _getProtocolInfo(marketPrice, floorPrice, claimBondFee, alphaAccrualFactor);

  return {
    bLusdSupply,
    marketPrice,
    fairPrice,
    floorPrice,
    claimBondFee,
    alphaAccrualFactor,
    simulatedMarketPrice,
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

interface ERC20Balance {
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
}

const getTokenBalance = async (account: string, token: ERC20Balance): Promise<Decimal> => {
  return decimalify(await token.balanceOf(account));
};

const isInfiniteBondApproved = async (account: string, lusdToken: LUSDToken): Promise<boolean> => {
  const allowance = await lusdToken.allowance(account, CHICKEN_BOND_MANAGER_ADDRESS);

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const approveInfiniteBond = async (lusdToken: LUSDToken | undefined) => {
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

  return (await token.approve(BLUSD_AMM_ADDRESS, constants.MaxUint256)).wait();
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

const amountsFrom = (bLusdAmount: Decimal, lusdAmount: Decimal) =>
  Array.from({
    length: 2,
    [BLusdAmmTokenIndex.BLUSD]: bLusdAmount.hex,
    [BLusdAmmTokenIndex.LUSD]: lusdAmount.hex
  }) as [string, string];

const getExpectedLpTokens = async (
  bLusdAmount: Decimal,
  lusdAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH
): Promise<Decimal> =>
  decimalify(await bLusdAmm.calc_token_amount(amountsFrom(bLusdAmount, lusdAmount)));

const addLiquidity = async (
  bLusdAmount: Decimal,
  lusdAmount: Decimal,
  minLpTokens: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<AddLiquidityEventObject> => {
  if (bLusdAmm === undefined) throw new Error("addLiquidity() failed: a dependency is null");

  const amounts = amountsFrom(bLusdAmount, lusdAmount);

  const gasEstimate = await bLusdAmm.estimateGas["add_liquidity(uint256[2],uint256)"](
    amounts,
    minLpTokens.hex
  );

  const receipt = await (
    await bLusdAmm["add_liquidity(uint256[2],uint256)"](
      amountsFrom(bLusdAmount, lusdAmount),
      minLpTokens.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  const addLiquidityEvent = receipt?.events?.find(
    e => e.event === "AddLiquidity"
  ) as Maybe<AddLiquidityEvent>;

  if (addLiquidityEvent === undefined) {
    throw new Error("addLiquidity() failed: couldn't find TokenExchange event");
  }

  console.log("addLiquidity() finished:", addLiquidityEvent.args);
  return addLiquidityEvent.args;
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
  claimBond,
  isTokenApprovedWithBLusdAmm,
  approveTokenWithBLusdAmm,
  getExpectedSwapOutput,
  swapTokens,
  getExpectedLpTokens,
  addLiquidity
};
