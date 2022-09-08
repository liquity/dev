import { BigNumber, CallOverrides, constants, Contract, providers, Signer } from "ethers";
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
  AddLiquidityEvent,
  AddLiquidityEventObject,
  RemoveLiquidityEvent,
  RemoveLiquidityEventObject,
  RemoveLiquidityOneEvent,
  RemoveLiquidityOneEventObject,
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
      const depositMinusClaimBondFee = Decimal.ONE.sub(claimBondFee).mul(deposit);
      const rebondAccrual =
        rebondDays === Decimal.INFINITY
          ? Decimal.INFINITY
          : getFutureBLusdAccrualFactor(floorPrice, rebondDays, alphaAccrualFactor).mul(
              depositMinusClaimBondFee
            );
      const breakEvenAccrual =
        breakEvenDays === Decimal.INFINITY
          ? Decimal.INFINITY
          : getFutureBLusdAccrualFactor(floorPrice, breakEvenDays, alphaAccrualFactor).mul(
              depositMinusClaimBondFee
            );

      const breakEvenTime =
        breakEvenDays === Decimal.INFINITY
          ? UNKNOWN_DATE
          : getFutureDateByDays(toFloat(breakEvenDays) - bondAgeInDays);
      const rebondTime =
        rebondDays === Decimal.INFINITY
          ? UNKNOWN_DATE
          : getFutureDateByDays(toFloat(rebondDays) - bondAgeInDays);
      const marketValue = decimalify(bondAccrueds[idx]).mul(marketPrice);

      // Accrued bLUSD is 0 for cancelled/claimed bonds
      const claimNowReturn = accrued.isZero ? 0 : getReturn(accrued, deposit, marketPrice);
      const rebondReturn = accrued.isZero ? 0 : getReturn(rebondAccrual, deposit, marketPrice);
      const rebondRoi = rebondReturn / toFloat(deposit);
      const rebondApr = rebondRoi * (365 / toFloat(rebondDays));

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
          rebondRoi,
          rebondApr
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
  const hasMarketPremium = marketPricePremium.mul(Decimal.ONE.sub(claimBondFee)).gt(Decimal.ONE);

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
  const floorPrice = bLusdSupply.isZero ? Decimal.ONE : reserveSize.div(bLusdSupply);
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

const getStats = async (chickenBondManager: ChickenBondManager): Promise<Stats> => {
  const [pendingBonds, cancelledBonds, claimedBonds] = await Promise.all([
    chickenBondManager.getOpenBondCount(),
    chickenBondManager.countChickenOut(),
    chickenBondManager.countChickenIn()
  ]);

  const totalBonds = pendingBonds.add(cancelledBonds).add(claimedBonds);

  return {
    pendingBonds: Decimal.from(pendingBonds.toString()),
    cancelledBonds: Decimal.from(cancelledBonds.toString()),
    claimedBonds: Decimal.from(claimedBonds.toString()),
    totalBonds: Decimal.from(totalBonds.toString())
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

// Very minimal type that only contains what we need
export interface ERC20 {
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

const erc20From = (tokenAddress: string, signerOrProvider: Signer | providers.Provider) =>
  (new Contract(
    tokenAddress,
    [
      "function balanceOf(address) view returns (uint256)",
      "function totalSupply() view returns (uint256)"
    ],
    signerOrProvider
  ) as unknown) as ERC20;

const getLpToken = async (pool: CurveCryptoSwap2ETH) =>
  erc20From(await pool.token(), pool.signer ?? pool.provider);

const getTokenBalance = async (account: string, token: ERC20): Promise<Decimal> => {
  return decimalify(await token.balanceOf(account));
};

const getTokenTotalSupply = async (token: ERC20): Promise<Decimal> => {
  return decimalify(await token.totalSupply());
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
      amounts,
      minLpTokens.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  const addLiquidityEvent = receipt?.events?.find(
    e => e.event === "AddLiquidity"
  ) as Maybe<AddLiquidityEvent>;

  if (addLiquidityEvent === undefined) {
    throw new Error("addLiquidity() failed: couldn't find AddLiquidity event");
  }

  console.log("addLiquidity() finished:", addLiquidityEvent.args);
  return addLiquidityEvent.args;
};

const getCoinBalances = (pool: CurveCryptoSwap2ETH) =>
  Promise.all([pool.balances(0).then(decimalify), pool.balances(1).then(decimalify)]);

const getExpectedWithdrawal = async (
  burnLp: Decimal,
  output: BLusdAmmTokenIndex | "both",
  bLusdAmm: CurveCryptoSwap2ETH
): Promise<Map<BLusdAmmTokenIndex, Decimal>> => {
  if (output === "both") {
    const lpToken = await getLpToken(bLusdAmm);
    const [totalLp, coinBalances] = await Promise.all([
      getTokenTotalSupply(lpToken),
      getCoinBalances(bLusdAmm)
    ]);

    if (totalLp.isZero || burnLp.isZero) {
      return new Map([
        [BLusdAmmTokenIndex.BLUSD, Decimal.ZERO],
        [BLusdAmmTokenIndex.LUSD, Decimal.ZERO]
      ]);
    }

    return new Map(coinBalances.map((balance, i) => [i, balance.mulDiv(burnLp, totalLp)]));
  } else {
    return new Map([
      [output, await bLusdAmm.calc_withdraw_one_coin(burnLp.hex, output).then(decimalify)]
    ]);
  }
};

const removeLiquidity = async (
  burnLpTokens: Decimal,
  minBLusdAmount: Decimal,
  minLusdAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<RemoveLiquidityEventObject> => {
  if (bLusdAmm === undefined) throw new Error("removeLiquidity() failed: a dependency is null");

  const minAmounts = amountsFrom(minBLusdAmount, minLusdAmount);

  const receipt = await (
    await bLusdAmm["remove_liquidity(uint256,uint256[2])"](burnLpTokens.hex, minAmounts)
  ).wait();

  const removeLiquidityEvent = receipt?.events?.find(
    e => e.event === "RemoveLiquidity"
  ) as Maybe<RemoveLiquidityEvent>;

  if (removeLiquidityEvent === undefined) {
    throw new Error("removeLiquidity() failed: couldn't find RemoveLiquidity event");
  }

  console.log("removeLiquidity() finished:", removeLiquidityEvent.args);
  return removeLiquidityEvent.args;
};

const removeLiquidityOneCoin = async (
  burnLpTokens: Decimal,
  output: BLusdAmmTokenIndex,
  minAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<RemoveLiquidityOneEventObject> => {
  if (bLusdAmm === undefined)
    throw new Error("removeLiquidityOneCoin() failed: a dependency is null");

  const gasEstimate = await bLusdAmm.estimateGas[
    "remove_liquidity_one_coin(uint256,uint256,uint256)"
  ](burnLpTokens.hex, output, minAmount.hex);

  const receipt = await (
    await bLusdAmm["remove_liquidity_one_coin(uint256,uint256,uint256)"](
      burnLpTokens.hex,
      output,
      minAmount.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  const removeLiquidityOneEvent = receipt?.events?.find(
    e => e.event === "RemoveLiquidityOne"
  ) as Maybe<RemoveLiquidityOneEvent>;

  if (removeLiquidityOneEvent === undefined) {
    throw new Error("removeLiquidityOneCoin() failed: couldn't find RemoveLiquidityOne event");
  }

  console.log("removeLiquidityOneCoin() finished:", removeLiquidityOneEvent.args);
  return removeLiquidityOneEvent.args;
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
  getStats: (chickenBondManager: ChickenBondManager) => Promise<Stats>;
  getTreasury: (chickenBondManager: ChickenBondManager) => Promise<Treasury>;
  getLpToken: (pool: CurveCryptoSwap2ETH) => Promise<ERC20>;
  getTokenBalance: (account: string, token: ERC20) => Promise<Decimal>;
  getTokenTotalSupply: (token: ERC20) => Promise<Decimal>;
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
  getCoinBalances: (pool: CurveCryptoSwap2ETH) => Promise<[Decimal, Decimal]>;
  getExpectedLpTokens: (
    bLusdAmount: Decimal,
    lusdAmount: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH
  ) => Promise<Decimal>;
  addLiquidity: (
    bLusdAmount: Decimal,
    lusdAmount: Decimal,
    minLpTokens: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH | undefined
  ) => Promise<AddLiquidityEventObject>;
  getExpectedWithdrawal: (
    burnLp: Decimal,
    output: BLusdAmmTokenIndex | "both",
    bLusdAmm: CurveCryptoSwap2ETH
  ) => Promise<Map<BLusdAmmTokenIndex, Decimal>>;
  removeLiquidity: (
    burnLpTokens: Decimal,
    minBLusdAmount: Decimal,
    minLusdAmount: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH | undefined
  ) => Promise<RemoveLiquidityEventObject>;
  removeLiquidityOneCoin: (
    burnLpTokens: Decimal,
    output: BLusdAmmTokenIndex,
    minAmount: Decimal,
    bLusdAmm: CurveCryptoSwap2ETH | undefined
  ) => Promise<RemoveLiquidityOneEventObject>;
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
  getLpToken,
  getTokenBalance,
  getTokenTotalSupply,
  getProtocolInfo,
  approveInfiniteBond,
  isInfiniteBondApproved,
  createBond,
  cancelBond,
  claimBond,
  isTokenApprovedWithBLusdAmm,
  approveTokenWithBLusdAmm,
  getExpectedSwapOutput,
  swapTokens,
  getCoinBalances,
  getExpectedLpTokens,
  addLiquidity,
  getExpectedWithdrawal,
  removeLiquidity,
  removeLiquidityOneCoin
};
