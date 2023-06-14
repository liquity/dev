import {
  BigNumber,
  BigNumberish,
  CallOverrides,
  constants,
  Contract,
  ContractTransaction,
  providers,
  Signer
} from "ethers";
// import { splitSignature } from "ethers/lib/utils";
import type {
  BLUSDToken,
  BondNFT,
  ChickenBondManager,
  BLUSDLPZap
} from "@liquity/chicken-bonds/lusd/types";
import {
  CurveCryptoSwap2ETH,
  CurveRegistrySwaps__factory
} from "@liquity/chicken-bonds/lusd/types/external";
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
import type { ProtocolInfo, Bond, BondStatus, Stats, Maybe, BLusdLpRewards } from "./transitions";
import {
  numberify,
  decimalify,
  getBondAgeInDays,
  milliseconds,
  toFloat,
  getReturn,
  getTokenUri,
  getFutureBLusdAccrualFactor,
  getRebondPeriodInDays,
  getBreakEvenPeriodInDays,
  getAverageBondAgeInSeconds,
  getRemainingRebondOrBreakEvenDays,
  getRebondOrBreakEvenTimeWithControllerAdjustment,
  getFloorPrice
} from "../utils";
import { UNKNOWN_DATE } from "../../HorizontalTimeline";
import { BLusdAmmTokenIndex } from "./transitions";
import {
  TokenExchangeEvent,
  TokenExchangeEventObject
} from "@liquity/chicken-bonds/lusd/types/external/CurveCryptoSwap2ETH";
import mainnet from "@liquity/chicken-bonds/lusd/addresses/mainnet.json";
import type {
  CurveLiquidityGaugeV5,
  DepositEvent,
  DepositEventObject,
  WithdrawEvent,
  WithdrawEventObject
} from "@liquity/chicken-bonds/lusd/types/external/CurveLiquidityGaugeV5";

const BOND_STATUS: BondStatus[] = ["NON_EXISTENT", "PENDING", "CANCELLED", "CLAIMED"];

const LUSD_3CRV_POOL_ADDRESS = "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA";
const LUSD_TOKEN_ADDRESS = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const CURVE_REGISTRY_SWAPS_ADDRESS = "0x81C46fECa27B31F3ADC2b91eE4be9717d1cd3DD7";
const BLUSD_LUSD_3CRV_POOL_ADDRESS = "0x74ED5d42203806c8CDCf2F04Ca5F60DC777b901c";
const CRV_TOKEN_ADDRESS = "0xD533a949740bb3306d119CC777fa900bA034cd52";

const TOKEN_ADDRESS_NAME_MAP: Record<string, string> = {
  [LUSD_TOKEN_ADDRESS]: "LUSD",
  [CRV_TOKEN_ADDRESS]: "CRV"
};

const LQTY_ISSUANCE_GAS_HEADROOM = BigNumber.from(50000);

// [
//   token_1,
//   pool_1,
//   token_2,
//   pool_2,
//   ...
//   pool_{n-1},
//   token_{n}
// ]
const bLusdToLusdRoute: [string, string, string, string, string] = [
  mainnet.BLUSD_TOKEN_ADDRESS ?? "",
  mainnet.BLUSD_AMM_ADDRESS ?? "",
  LUSD_3CRV_POOL_ADDRESS, // LP token of LUSD-3Crv-f has same address as pool
  LUSD_3CRV_POOL_ADDRESS,
  LUSD_TOKEN_ADDRESS
];

const lusdToBLusdRoute = [...bLusdToLusdRoute].reverse() as typeof bLusdToLusdRoute;

type RouteAddresses = [string, string, string, string, string, string, string, string, string];
type RouteSwapParams = [BigNumberish, BigNumberish, BigNumberish];
type RouteSwaps = [RouteSwapParams, RouteSwapParams, RouteSwapParams, RouteSwapParams];

const getRoute = (inputToken: BLusdAmmTokenIndex): [RouteAddresses, RouteSwaps] => [
  [
    ...(inputToken === BLusdAmmTokenIndex.BLUSD ? bLusdToLusdRoute : lusdToBLusdRoute),
    constants.AddressZero,
    constants.AddressZero,
    constants.AddressZero,
    constants.AddressZero
  ],
  [
    // Params:
    // 1) input token index (unused by remove_liquidity_one_coin())
    // 2) output token index (unused by add_liquidity())
    // 3) function to call (see below)
    //
    // Functions:
    // 3 = exchange() in crypto pool
    // 6 = add_liquidity() single-sidedly to 2-pool
    // 9 = remove_liquidity_one_coin()
    //
    // Indices:
    // - bLUSD pool: { 0: bLUSD, 1: LUSD-3Crv-f }
    // - LUSD-3Crv-f pool: { 0: LUSD, 1: 3Crv }

    //                                          bLUSD        LUSD
    inputToken === BLusdAmmTokenIndex.BLUSD ? [0, 1, 3] : [0, 0, 6], // step 1
    inputToken === BLusdAmmTokenIndex.BLUSD ? [0, 0, 9] : [1, 0, 3], // step 2
    [0, 0, 0], //                                LUSD       bLUSD
    [0, 0, 0]
  ]
];

type CachedYearnApys = {
  lusd3Crv: Decimal | undefined;
  stabilityPool: Decimal | undefined;
  bLusdLusd3Crv: Decimal | undefined;
};

const cachedApys: CachedYearnApys = {
  lusd3Crv: undefined,
  stabilityPool: undefined,
  bLusdLusd3Crv: undefined
};

type YearnVault = Partial<{
  token: {
    address: string;
  };
  apy: {
    net_apy: number;
  };
}>;

type CurvePoolData = Partial<{
  data: {
    poolData: Array<{ id: string; gaugeRewards: Array<{ apy: number }> }>;
  };
}>;

type CurvePoolDetails = Partial<{
  data: {
    poolDetails: Array<{ poolAddress: string; apy: number }>;
  };
}>;

const CURVE_POOL_ID = "factory-crypto-134";

const cacheCurveLpApy = async (): Promise<void> => {
  try {
    const curvePoolDataResponse = (await (
      await window.fetch("https://api.curve.fi/api/getPools/ethereum/factory-crypto")
    ).json()) as CurvePoolData;

    const curvePoolDetailsResponse = (await await (
      await window.fetch("https://api.curve.fi/api/getFactoryAPYs?version=crypto")
    ).json()) as CurvePoolDetails;

    const poolData = curvePoolDataResponse.data?.poolData.find(pool => pool.id === CURVE_POOL_ID);
    const rewardsApr = poolData?.gaugeRewards.reduce((total, current) => total + current.apy, 0);
    const baseApr = curvePoolDetailsResponse?.data?.poolDetails?.find(
      pool => pool.poolAddress === BLUSD_LUSD_3CRV_POOL_ADDRESS
    )?.apy;

    if (rewardsApr === undefined && baseApr === undefined) return;

    const apr = (rewardsApr ?? 0) + (baseApr ?? 0);

    cachedApys.bLusdLusd3Crv = Decimal.from(apr);
  } catch (error: unknown) {
    console.log("cacheCurveLpApy failed");
    console.error(error);
  }
};

const cacheYearnVaultApys = async (): Promise<void> => {
  try {
    if (cachedApys.lusd3Crv !== undefined) return;

    const yearnResponse = (await (
      await window.fetch("https://api.yearn.finance/v1/chains/1/vaults/all")
    ).json()) as YearnVault[];

    const lusd3CrvVault = yearnResponse.find(
      vault => vault?.token?.address === LUSD_3CRV_POOL_ADDRESS
    );

    const stabilityPoolVault = yearnResponse.find(
      vault => vault?.token?.address === LUSD_TOKEN_ADDRESS
    );

    if (
      lusd3CrvVault?.apy?.net_apy === undefined ||
      stabilityPoolVault?.apy?.net_apy === undefined
    ) {
      return;
    }

    cachedApys.lusd3Crv = Decimal.from(lusd3CrvVault.apy.net_apy);
    cachedApys.stabilityPool = Decimal.from(stabilityPoolVault.apy.net_apy);
  } catch (error: unknown) {
    console.log("cacheYearnVaultApys failed");
    console.error(error);
  }
};

const getAccountBonds = async (
  account: string,
  bondNft: BondNFT,
  chickenBondManager: ChickenBondManager,
  protocolInfo: ProtocolInfo
): Promise<Bond[]> => {
  try {
    const {
      marketPrice,
      alphaAccrualFactor,
      marketPricePremium,
      claimBondFee,
      floorPrice,
      controllerTargetAge,
      averageBondAge
    } = protocolInfo;

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
      tokenUris: bondIds.map(bondId => bondNft.tokenURI(bondId)),
      claimedAmounts: bondIds.map(bondId => bondNft.getBondClaimedBLUSD(bondId))
    };

    const bondDeposits = await Promise.all(bondRequests.deposits);
    const bondAccrueds = await Promise.all(bondRequests.accrueds);
    const bondStartTimes = await Promise.all(bondRequests.startTimes);
    const bondEndTimes = await Promise.all(bondRequests.endTimes);
    const bondStatuses = await Promise.all(bondRequests.statuses);
    const bondTokenUris = await Promise.all(bondRequests.tokenUris);
    const bondClaimedAmounts = await Promise.all(bondRequests.claimedAmounts);

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
        const rebondPeriodInDays = getRebondPeriodInDays(
          alphaAccrualFactor,
          marketPricePremium,
          claimBondFee
        );
        const bondAgeInSeconds = Decimal.from(Date.now() - startTime).div(1000);
        const remainingRebondDays = getRemainingRebondOrBreakEvenDays(
          bondAgeInSeconds,
          controllerTargetAge,
          averageBondAge,
          rebondPeriodInDays
        );

        const breakEvenPeriodInDays = getBreakEvenPeriodInDays(
          alphaAccrualFactor,
          marketPricePremium,
          claimBondFee
        );
        const remainingBreakEvenDays = getRemainingRebondOrBreakEvenDays(
          bondAgeInSeconds,
          controllerTargetAge,
          averageBondAge,
          breakEvenPeriodInDays
        );

        const depositMinusClaimBondFee = Decimal.ONE.sub(claimBondFee).mul(deposit);
        const rebondAccrual =
          rebondPeriodInDays === Decimal.INFINITY
            ? Decimal.INFINITY
            : getFutureBLusdAccrualFactor(floorPrice, rebondPeriodInDays, alphaAccrualFactor).mul(
                depositMinusClaimBondFee
              );

        const breakEvenAccrual =
          breakEvenPeriodInDays === Decimal.INFINITY
            ? Decimal.INFINITY
            : getFutureBLusdAccrualFactor(floorPrice, breakEvenPeriodInDays, alphaAccrualFactor).mul(
                depositMinusClaimBondFee
              );

        const breakEvenTime =
          breakEvenPeriodInDays === Decimal.INFINITY
            ? UNKNOWN_DATE
            : getRebondOrBreakEvenTimeWithControllerAdjustment(
                bondAgeInSeconds,
                controllerTargetAge,
                averageBondAge,
                breakEvenPeriodInDays
              );

        const rebondTime =
          rebondPeriodInDays === Decimal.INFINITY
            ? UNKNOWN_DATE
            : getRebondOrBreakEvenTimeWithControllerAdjustment(
                bondAgeInSeconds,
                controllerTargetAge,
                averageBondAge,
                rebondPeriodInDays
              );

        const marketValue = decimalify(bondAccrueds[idx]).mul(marketPrice);

        // Accrued bLUSD is 0 for cancelled/claimed bonds
        const claimNowReturn = accrued.isZero ? 0 : getReturn(accrued, deposit, marketPrice);
        const rebondReturn = accrued.isZero ? 0 : getReturn(rebondAccrual, deposit, marketPrice);
        const rebondRoi = rebondReturn / toFloat(deposit);
        const rebondApr = rebondRoi * (365 / (bondAgeInDays + remainingRebondDays));
        const claimedAmount = Decimal.from(numberify(bondClaimedAmounts[idx]));

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
            rebondApr,
            claimedAmount,
            bondAgeInDays,
            remainingRebondDays,
            remainingBreakEvenDays
          }
        ];
      }, [])
      .sort((a, b) => (a.startTime > b.startTime ? -1 : a.startTime < b.startTime ? 1 : 0));

    return bonds;
  } catch (error: unknown) {
    console.error(error);
  }
  return [];
};

export const _getProtocolInfo = (
  marketPrice: Decimal,
  floorPrice: Decimal,
  claimBondFee: Decimal,
  alphaAccrualFactor: Decimal
) => {
  const marketPricePremium = marketPrice.div(floorPrice);
  const hasMarketPremium = marketPricePremium.mul(Decimal.ONE.sub(claimBondFee)).gt(Decimal.ONE);

  const breakEvenPeriodInDays = getBreakEvenPeriodInDays(
    alphaAccrualFactor,
    marketPricePremium,
    claimBondFee
  );
  const rebondPeriodInDays = getRebondPeriodInDays(
    alphaAccrualFactor,
    marketPricePremium,
    claimBondFee
  );
  const breakEvenAccrualFactor = getFutureBLusdAccrualFactor(
    floorPrice,
    breakEvenPeriodInDays,
    alphaAccrualFactor
  );
  const rebondAccrualFactor = getFutureBLusdAccrualFactor(
    floorPrice,
    rebondPeriodInDays,
    alphaAccrualFactor
  );

  return {
    marketPricePremium,
    hasMarketPremium,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenPeriodInDays,
    rebondPeriodInDays
  };
};

const marginalInputAmount = Decimal.ONE.div(1000);

const getBlusdAmmPrice = async (bLusdAmm: CurveCryptoSwap2ETH): Promise<Decimal> => {
  try {
    const marginalOutputAmount = await getExpectedSwapOutput(
      BLusdAmmTokenIndex.BLUSD,
      marginalInputAmount,
      bLusdAmm
    );

    return marginalOutputAmount.div(marginalInputAmount);
  } catch (error: unknown) {
    console.error("bLUSD AMM get_dy() price failed, probably has no liquidity?", error);
  }

  return Decimal.ONE.div(decimalify(await bLusdAmm.price_oracle()));
};

const getBlusdAmmPriceMainnet = async (bLusdAmm: CurveCryptoSwap2ETH): Promise<Decimal> => {
  try {
    const marginalOutputAmount = await getExpectedSwapOutputMainnet(
      BLusdAmmTokenIndex.BLUSD,
      marginalInputAmount,
      bLusdAmm
    );

    return marginalOutputAmount.div(marginalInputAmount);
  } catch (error: unknown) {
    console.error("getExpectedSwapOutputMainnet() failed, probably no liquidity?", error);
  }

  const lusd3CrvPool = new Contract(
    LUSD_3CRV_POOL_ADDRESS,
    [
      "function calc_withdraw_one_coin(uint256 burn_amount, int128 i) external view returns (uint256)"
    ],
    bLusdAmm.provider
  );

  const [oraclePrice, marginalOutputAmount] = await Promise.all([
    bLusdAmm.price_oracle().then(decimalify),
    lusd3CrvPool.calc_withdraw_one_coin(marginalInputAmount.hex, 0 /* LUSD */).then(decimalify)
  ]);

  return marginalOutputAmount.div(marginalInputAmount).div(oraclePrice);
};

const getProtocolInfo = async (
  bLusdToken: BLUSDToken,
  bLusdAmm: CurveCryptoSwap2ETH,
  chickenBondManager: ChickenBondManager,
  isMainnet: boolean
): Promise<ProtocolInfo> => {
  // TS breaks when including this call, or any more than 10 elements, in the Promise.all below.
  const bammLusdDebtRequest = chickenBondManager.getBAMMLUSDDebt().then(decimalify);

  const [
    bLusdSupply,
    marketPrice,
    _treasury,
    protocolOwnedLusdInStabilityPool,
    protocolLusdInCurve,
    _floorPrice,
    claimBondFee,
    alphaAccrualFactor,
    controllerTargetAge,
    totalWeightedStartTimes
  ] = await Promise.all([
    bLusdToken.totalSupply().then(decimalify),
    isMainnet ? getBlusdAmmPriceMainnet(bLusdAmm) : getBlusdAmmPrice(bLusdAmm),
    chickenBondManager.getTreasury().then(bucket => bucket.map(decimalify)),
    chickenBondManager.getOwnedLUSDInSP().then(decimalify),
    chickenBondManager.getTotalLUSDInCurve().then(decimalify),
    chickenBondManager.calcSystemBackingRatio().then(decimalify),
    chickenBondManager.CHICKEN_IN_AMM_FEE().then(decimalify),
    chickenBondManager.calcUpdatedAccrualParameter().then(p => decimalify(p).div(24 * 60 * 60)),
    chickenBondManager.targetAverageAgeSeconds().then(t => Decimal.from(t.toString())),
    chickenBondManager.totalWeightedStartTimes().then(decimalify)
  ]);

  const bammLusdDebt = await bammLusdDebtRequest;

  const treasury = {
    pending: _treasury[0],
    reserve: _treasury[1],
    permanent: _treasury[2],
    total: _treasury[0].add(_treasury[1]).add(_treasury[2])
  };

  const cachedApysRequests =
    cachedApys.lusd3Crv === undefined ||
    cachedApys.stabilityPool === undefined ||
    cachedApys.bLusdLusd3Crv === undefined
      ? [cacheYearnVaultApys(), cacheCurveLpApy()]
      : null;

  const protocolLusdInStabilityPool = treasury.pending.add(protocolOwnedLusdInStabilityPool);

  const floorPrice = bLusdSupply.isZero ? Decimal.ONE : _floorPrice;

  const floorPriceWithoutPendingHarvests = bLusdSupply.isZero
    ? Decimal.ONE
    : getFloorPrice(
        bammLusdDebt,
        protocolLusdInCurve,
        treasury.pending,
        treasury.permanent,
        bLusdSupply
      );

  const averageBondAge = getAverageBondAgeInSeconds(totalWeightedStartTimes, treasury.pending);

  let yieldAmplification: Maybe<Decimal> = undefined;
  let bLusdApr: Maybe<Decimal> = undefined;
  const bLusdLpApr: Maybe<Decimal> = cachedApys.bLusdLusd3Crv;

  const fairPrice = {
    lower: treasury.total.sub(treasury.pending).div(bLusdSupply),
    upper: treasury.total.div(bLusdSupply)
  };

  const {
    marketPricePremium,
    hasMarketPremium,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenPeriodInDays,
    rebondPeriodInDays
  } = _getProtocolInfo(marketPrice, floorPrice, claimBondFee, alphaAccrualFactor);

  const simulatedMarketPrice = marketPrice;

  const windDownPrice = treasury.reserve.add(treasury.permanent).div(bLusdSupply);

  // We need to know APYs to calculate the stats below
  if (cachedApysRequests) await Promise.all(cachedApysRequests);

  if (
    cachedApys.lusd3Crv !== undefined &&
    cachedApys.stabilityPool !== undefined &&
    treasury.reserve.gt(0)
  ) {
    const protocolStabilityPoolYield = cachedApys.stabilityPool.mul(protocolLusdInStabilityPool);
    const protocolCurveYield = cachedApys.lusd3Crv.mul(protocolLusdInCurve);
    bLusdApr = protocolStabilityPoolYield.add(protocolCurveYield).div(treasury.reserve);
    yieldAmplification = bLusdApr.div(cachedApys.stabilityPool);

    fairPrice.lower = protocolLusdInStabilityPool
      .sub(treasury.pending)
      .add(protocolLusdInCurve.mul(cachedApys.lusd3Crv.div(cachedApys.stabilityPool)))
      .div(bLusdSupply);

    fairPrice.upper = protocolLusdInStabilityPool
      .add(protocolLusdInCurve.mul(cachedApys.lusd3Crv.div(cachedApys.stabilityPool)))
      .div(bLusdSupply);
  }

  return {
    bLusdSupply,
    marketPrice,
    treasury,
    fairPrice,
    floorPrice,
    claimBondFee,
    alphaAccrualFactor,
    marketPricePremium,
    hasMarketPremium,
    breakEvenAccrualFactor,
    rebondAccrualFactor,
    breakEvenPeriodInDays,
    rebondPeriodInDays,
    simulatedMarketPrice,
    yieldAmplification,
    bLusdApr,
    bLusdLpApr,
    controllerTargetAge,
    averageBondAge,
    floorPriceWithoutPendingHarvests,
    windDownPrice
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

// Very minimal type that only contains what we need
export interface ERC20 {
  approve(
    spender: string,
    amount: BigNumber,
    _overrides?: CallOverrides
  ): Promise<ContractTransaction>;
  allowance(account: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

const erc20From = (tokenAddress: string, signerOrProvider: Signer | providers.Provider) =>
  (new Contract(
    tokenAddress,
    [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
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

const isInfiniteBondApproved = async (
  account: string,
  lusdToken: LUSDToken,
  chickenBondManager: ChickenBondManager
): Promise<boolean> => {
  const allowance = await lusdToken.allowance(account, chickenBondManager.address);

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const approveInfiniteBond = async (
  lusdToken: LUSDToken | undefined,
  chickenBondManager: ChickenBondManager | undefined,
  signer: Signer | undefined
): Promise<void> => {
  if (lusdToken === undefined || chickenBondManager === undefined || signer === undefined) {
    throw new Error("approveInfiniteBond() failed: a dependency is null");
  }

  console.log("approveInfiniteBond() started");

  try {
    await (
      await ((lusdToken as unknown) as Contract)
        .connect(signer)
        .approve(chickenBondManager.address, constants.MaxUint256._hex)
    ).wait();

    console.log("approveInfiniteBond() succceeded");
  } catch (error: unknown) {
    throw new Error(`approveInfiniteBond() failed: ${error}`);
  }
};

const createBond = async (
  lusdAmount: Decimal,
  owner: string,
  chickenBondManager: ChickenBondManager | undefined,
  signer: Signer | undefined
): Promise<BondCreatedEventObject> => {
  if (chickenBondManager === undefined || signer === undefined) {
    throw new Error("createBond() failed: a dependency is null");
  }

  const gasEstimate = await chickenBondManager.estimateGas.createBond(lusdAmount.hex, {
    from: owner
  });

  const receipt = await (
    await chickenBondManager.connect(signer).createBond(lusdAmount.hex, {
      gasLimit: gasEstimate.add(LQTY_ISSUANCE_GAS_HEADROOM)
    })
  ).wait();

  console.log(
    "CREATE BOND",
    receipt?.events,
    receipt?.events?.map(c => c.event),
    receipt?.events?.find(e => e.event === "BondCreated")
  );

  const createdEvent = receipt?.events?.find(
    e => e.event === "BondCreated"
  ) as Maybe<BondCreatedEvent>;

  if (createdEvent === undefined) {
    throw new Error("createBond() failed: couldn't find BondCreated event");
  }

  console.log("createBond() finished:", createdEvent.args);
  return createdEvent.args;
};

/*
const createBondWithPermit = async (
  lusdAmount: Decimal,
  owner: string,
  lusdAddress: string,
  lusdToken: LUSDToken | undefined,
  chickenBondManager: ChickenBondManager | undefined,
  signer: EthersSigner
): Promise<BondCreatedEventObject> => {
  if (chickenBondManager === undefined || lusdToken === undefined) {
    throw new Error("createBondWithPermit() failed: a dependency is null");
  }

  const TEN_MINUTES_IN_SECONDS = 60 * 10;
  const spender = chickenBondManager.address;
  const deadline = Math.round(Date.now() / 1000) + TEN_MINUTES_IN_SECONDS;
  const nonce = (await lusdToken.nonces(owner)).toNumber();
  const domain = {
    name: await lusdToken.name(),
    version: "1",
    chainId: await signer.getChainId(),
    verifyingContract: lusdAddress
  };
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" }
    ]
  };
  const message = {
    owner,
    spender,
    value: lusdAmount.hex,
    nonce,
    deadline
  };

  // @ts-ignore - Ethers private func as API not stable yet
  const signature = await signer._signTypedData(domain, types, message);

  const { v, r, s } = splitSignature(signature);

  const gasEstimate = await chickenBondManager.estimateGas.createBondWithPermit(
    owner,
    lusdAmount.hex,
    deadline,
    v,
    r,
    s
  );

  const receipt = await (
    await chickenBondManager.createBondWithPermit(owner, lusdAmount.hex, deadline, v, r, s, {
      gasLimit: gasEstimate.add(LQTY_ISSUANCE_GAS_HEADROOM)
    })
  ).wait();

  console.log(
    "CREATE BOND",
    receipt?.events,
    receipt?.events?.map(c => c.event),
    receipt?.events?.find(e => e.event === "BondCreated")
  );
  const createdEvent = receipt?.events?.find(
    e => e.event === "BondCreated"
  ) as Maybe<BondCreatedEvent>;

  if (createdEvent === undefined) {
    throw new Error("createBond() failed: couldn't find BondCreated event");
  }

  console.log("createBond() finished:", createdEvent.args);
  return createdEvent.args;
};
*/

const cancelBond = async (
  bondId: string,
  minimumLusd: Decimal,
  owner: string,
  chickenBondManager: ChickenBondManager | undefined,
  signer: Signer | undefined
): Promise<BondCancelledEventObject> => {
  if (chickenBondManager === undefined || signer === undefined) {
    throw new Error("cancelBond() failed: a dependency is null");
  }

  console.log("cancelBond() started:", bondId, minimumLusd.toString());

  const gasEstimate = await chickenBondManager.estimateGas.chickenOut(bondId, minimumLusd.hex, {
    from: owner
  });

  const receipt = await (
    await chickenBondManager.connect(signer).chickenOut(bondId, minimumLusd.hex, {
      gasLimit: gasEstimate.add(LQTY_ISSUANCE_GAS_HEADROOM)
    })
  ).wait();

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
  owner: string,
  chickenBondManager: ChickenBondManager | undefined,
  signer: Signer | undefined
): Promise<BondClaimedEventObject> => {
  try {
    if (chickenBondManager === undefined || signer === undefined) {
      throw new Error("claimBond() failed: a dependency is null");
    }

    console.log("claimBond() started", bondId);

    const gasEstimate = await chickenBondManager.estimateGas.chickenIn(bondId, { from: owner });

    const receipt = await (
      await chickenBondManager.connect(signer).chickenIn(bondId, {
        gasLimit: gasEstimate.add(LQTY_ISSUANCE_GAS_HEADROOM)
      })
    ).wait();

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
  token: LUSDToken | BLUSDToken,
  bLusdAmmAddress: string | null
): Promise<boolean> => {
  if (bLusdAmmAddress === null) {
    throw new Error("isTokenApprovedWithBLusdAmm() failed: a dependency is null");
  }

  const allowance = await token.allowance(account, bLusdAmmAddress);

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const isTokenApprovedWithBLusdAmmMainnet = async (
  account: string,
  token: LUSDToken | BLUSDToken
): Promise<boolean> => {
  const allowance = await token.allowance(account, CURVE_REGISTRY_SWAPS_ADDRESS);

  // Unlike bLUSD, LUSD doesn't explicitly handle infinite approvals, therefore the allowance will
  // start to decrease from 2**64.
  // However, it is practically impossible that it would decrease below 2**63.
  return allowance.gt(constants.MaxInt256);
};

const isTokenApprovedWithAmmZapper = async (
  account: string,
  token: LUSDToken | BLUSDToken | ERC20,
  ammZapperAddress: string | null
): Promise<boolean> => {
  if (ammZapperAddress === null) {
    throw new Error("isTokenApprovedWithAmmZapper() failed: a dependency is null");
  }
  const allowance = await token.allowance(account, ammZapperAddress);
  return allowance.gt(constants.MaxInt256);
};

const approveTokenWithBLusdAmm = async (
  token: LUSDToken | BLUSDToken | undefined,
  bLusdAmmAddress: string | null,
  signer: Signer | undefined
) => {
  if (token === undefined || bLusdAmmAddress === null || signer === undefined) {
    throw new Error("approveTokenWithBLusdAmm() failed: a dependency is null");
  }

  await (
    await (token as Contract).connect(signer).approve(bLusdAmmAddress, constants.MaxUint256)
  ).wait();
  return;
};

const approveToken = async (
  token: LUSDToken | BLUSDToken | ERC20 | undefined,
  spenderAddress: string | null,
  signer: Signer | undefined
) => {
  if (token === undefined || spenderAddress === null || signer === undefined) {
    throw new Error("approveToken() failed: a dependency is null");
  }

  await (
    await (token as Contract).connect(signer).approve(spenderAddress, constants.MaxUint256)
  ).wait();
  return;
};

const approveTokenWithBLusdAmmMainnet = async (
  token: LUSDToken | BLUSDToken | undefined,
  signer: Signer | undefined
) => {
  if (token === undefined || signer === undefined) {
    throw new Error("approveTokenWithBLusdAmmMainnet() failed: a dependency is null");
  }

  await (
    await (token as Contract)
      .connect(signer)
      .approve(CURVE_REGISTRY_SWAPS_ADDRESS, constants.MaxUint256)
  ).wait();
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

const getExpectedSwapOutputMainnet = async (
  inputToken: BLusdAmmTokenIndex,
  inputAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH
): Promise<Decimal> => {
  const bLusdAmmBalance = await bLusdAmm.balances(0);
  // Initial Curve bLUSD price before liquidity = 1.29, reciprocal expected
  const reciprocal = Decimal.from(1).div(1.29);
  if (bLusdAmmBalance.eq(0)) return inputAmount.div(reciprocal);

  const swaps = CurveRegistrySwaps__factory.connect(CURVE_REGISTRY_SWAPS_ADDRESS, bLusdAmm.provider);

  return decimalify(
    await swaps["get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"](
      ...getRoute(inputToken),
      inputAmount.hex
    )
  );
};

const swapTokens = async (
  inputToken: BLusdAmmTokenIndex,
  inputAmount: Decimal,
  minOutputAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined,
  signer: Signer | undefined,
  account: string
): Promise<TokenExchangeEventObject> => {
  if (bLusdAmm === undefined || signer === undefined) {
    throw new Error("swapTokens() failed: a dependency is null");
  }

  const gasEstimate = await bLusdAmm.estimateGas[
    "exchange(uint256,uint256,uint256,uint256)"
  ](inputToken, getOtherToken(inputToken), inputAmount.hex, minOutputAmount.hex, { from: account });

  const receipt = await (
    await bLusdAmm.connect(signer)["exchange(uint256,uint256,uint256,uint256)"](
      inputToken,
      getOtherToken(inputToken),
      inputAmount.hex,
      minOutputAmount.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
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

const swapTokensMainnet = async (
  inputToken: BLusdAmmTokenIndex,
  inputAmount: Decimal,
  minOutputAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined,
  signer: Signer | undefined,
  account: string
): Promise<void> => {
  if (bLusdAmm === undefined || signer === undefined) {
    throw new Error("swapTokensMainnet() failed: a dependency is null");
  }

  const swaps = CurveRegistrySwaps__factory.connect(CURVE_REGISTRY_SWAPS_ADDRESS, bLusdAmm.provider);
  const route = getRoute(inputToken);

  const gasEstimate = await swaps.estimateGas[
    "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"
  ](...route, inputAmount.hex, minOutputAmount.hex, { from: account });

  const receipt = await (
    await swaps.connect(signer)["exchange_multiple(address[9],uint256[3][4],uint256,uint256)"](
      ...route,
      inputAmount.hex,
      minOutputAmount.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  if (!receipt.status) {
    throw new Error("swapTokensMainnet() failed");
  }

  console.log("swapTokensMainnet() finished");
};

const getExpectedLpTokensAmountViaZapper = async (
  bLusdAmount: Decimal,
  lusdAmount: Decimal,
  bLusdZapper: BLUSDLPZap
): Promise<Decimal> => {
  // allow 0.1% rounding error
  return decimalify(await bLusdZapper.getMinLPTokens(bLusdAmount.hex, lusdAmount.hex)).mul(0.99);
};

const getExpectedLpTokens = async (
  bLusdAmount: Decimal,
  lusdAmount: Decimal,
  bLusdZapper: BLUSDLPZap
): Promise<Decimal> => {
  // Curve's calc_token_amount has rounding errors and they enforce a minimum 0.1% slippage
  let expectedLpTokenAmount = Decimal.ZERO;
  try {
    // If the user is depositing bLUSD single sided, they won't have approved any.. WONT-FIX
    expectedLpTokenAmount = await getExpectedLpTokensAmountViaZapper(
      bLusdAmount,
      lusdAmount,
      bLusdZapper
    );
  } catch {
    // Curve throws if there's no liquidity
    return expectedLpTokenAmount;
  }
  return expectedLpTokenAmount;
};

const addLiquidity = async (
  bLusdAmount: Decimal,
  lusdAmount: Decimal,
  minLpTokens: Decimal,
  shouldStakeInGauge: boolean,
  bLusdZapper: BLUSDLPZap | undefined,
  signer: Signer | undefined,
  account: string
): Promise<void> => {
  if (bLusdZapper === undefined || signer === undefined) {
    throw new Error("addLiquidity() failed: a dependency is null");
  }

  const zapperFunction = shouldStakeInGauge ? "addLiquidityAndStake" : "addLiquidity";

  const gasEstimate = await bLusdZapper.estimateGas[zapperFunction](
    bLusdAmount.hex,
    lusdAmount.hex,
    minLpTokens.hex,
    { from: account }
  );

  const receipt = await (
    await bLusdZapper.connect(signer)[zapperFunction](
      bLusdAmount.hex,
      lusdAmount.hex,
      minLpTokens.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  if (!receipt.status) {
    throw new Error("addLiquidity() failed");
  }

  console.log("addLiquidity() finished");
};

const getCoinBalances = (pool: CurveCryptoSwap2ETH) =>
  Promise.all([pool.balances(0).then(decimalify), pool.balances(1).then(decimalify)]);

const getExpectedWithdrawal = async (
  burnLp: Decimal,
  output: BLusdAmmTokenIndex | "both",
  bLusdZapper: BLUSDLPZap,
  bLusdAmm: CurveCryptoSwap2ETH
): Promise<Map<BLusdAmmTokenIndex, Decimal>> => {
  if (output === "both") {
    const [bLusdAmount, lusdAmount] = await bLusdZapper.getMinWithdrawBalanced(burnLp.hex);

    return new Map([
      [BLusdAmmTokenIndex.BLUSD, decimalify(bLusdAmount)],
      [BLusdAmmTokenIndex.LUSD, decimalify(lusdAmount)]
    ]);
  } else {
    const withdrawEstimatorFunction =
      output === BLusdAmmTokenIndex.LUSD
        ? () => bLusdZapper.getMinWithdrawLUSD(burnLp.hex)
        : () => bLusdAmm.calc_withdraw_one_coin(burnLp.hex, 0);
    return new Map([[output, await withdrawEstimatorFunction().then(decimalify)]]);
  }
};

const removeLiquidity = async (
  burnLpTokens: Decimal,
  minBLusdAmount: Decimal,
  minLusdAmount: Decimal,
  bLusdZapper: BLUSDLPZap | undefined,
  signer: Signer | undefined
): Promise<void> => {
  if (bLusdZapper === undefined || signer === undefined) {
    throw new Error("removeLiquidity() failed: a dependency is null");
  }

  const receipt = await (
    await bLusdZapper
      .connect(signer)
      .removeLiquidityBalanced(burnLpTokens.hex, minBLusdAmount.hex, minLusdAmount.hex)
  ).wait();

  if (!receipt.status) {
    throw new Error("removeLiquidity() failed");
  }

  console.log("removeLiquidity() finished");
};

const removeLiquidityLUSD = async (
  burnLpTokens: Decimal,
  minAmount: Decimal,
  bLusdZapper: BLUSDLPZap | undefined,
  signer: Signer | undefined,
  account: string
): Promise<void> => {
  if (bLusdZapper === undefined || signer === undefined) {
    throw new Error("removeLiquidityLUSD() failed: a dependency is null");
  }

  const removeLiquidityFunction = "removeLiquidityLUSD";

  const gasEstimate = await bLusdZapper.estimateGas[removeLiquidityFunction](
    burnLpTokens.hex,
    minAmount.hex,
    { from: account }
  );

  const receipt = await (
    await bLusdZapper.connect(signer)[removeLiquidityFunction](
      burnLpTokens.hex,
      minAmount.hex,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  if (!receipt.status) {
    throw new Error("removeLiquidityLUSD() failed");
  }

  console.log("removeLiquidityLUSD() finished");
};

const removeLiquidityBLUSD = async (
  burnLpTokens: Decimal,
  minAmount: Decimal,
  bLusdAmm: CurveCryptoSwap2ETH | undefined,
  signer: Signer | undefined,
  account: string
): Promise<void> => {
  if (bLusdAmm === undefined || signer === undefined) {
    throw new Error("removeLiquidityBLUSD() failed: a dependency is null");
  }

  const removeLiquidityFunction = "remove_liquidity_one_coin(uint256,uint256,uint256,bool)";

  const gasEstimate = await bLusdAmm.estimateGas[removeLiquidityFunction](
    burnLpTokens.hex,
    0,
    minAmount.hex,
    false,
    { from: account }
  );

  const receipt = await (
    await bLusdAmm.connect(signer)[removeLiquidityFunction](
      burnLpTokens.hex,
      0,
      minAmount.hex,
      false,
      { gasLimit: gasEstimate.mul(6).div(5) } // Add 20% overhead (we've seen it fail otherwise)
    )
  ).wait();

  if (!receipt.status) {
    throw new Error("removeLiquidityBLUSD() failed");
  }

  console.log("removeLiquidityBLUSD() finished");
};

const removeLiquidityOneCoin = async (
  burnLpTokens: Decimal,
  output: BLusdAmmTokenIndex,
  minAmount: Decimal,
  bLusdZapper: BLUSDLPZap | undefined,
  bLusdAmm: CurveCryptoSwap2ETH | undefined,
  signer: Signer | undefined,
  account: string
): Promise<void> => {
  if (output === BLusdAmmTokenIndex.LUSD) {
    return removeLiquidityLUSD(burnLpTokens, minAmount, bLusdZapper, signer, account);
  } else {
    return removeLiquidityBLUSD(burnLpTokens, minAmount, bLusdAmm, signer, account);
  }
};

const stakeLiquidity = async (
  stakeAmount: Decimal,
  bLusdGauge: CurveLiquidityGaugeV5 | undefined,
  signer: Signer | undefined
): Promise<DepositEventObject> => {
  if (bLusdGauge === undefined || signer === undefined) {
    throw new Error("stakeLiquidity() failed: a dependency is null");
  }

  const receipt = await (
    await bLusdGauge.connect(signer)["deposit(uint256)"](stakeAmount.hex)
  ).wait();

  const depositEvent = receipt?.events?.find(e => e?.event === "Deposit") as Maybe<DepositEvent>;

  if (depositEvent === undefined) {
    throw new Error("stakeLiquidity() failed: couldn't find Withdraw event");
  }

  console.log("stakeLiquidity() finished:", depositEvent.args);
  return depositEvent.args;
};

const unstakeLiquidity = async (
  unstakeAmount: Decimal,
  bLusdGauge: CurveLiquidityGaugeV5 | undefined,
  signer: Signer | undefined
): Promise<WithdrawEventObject> => {
  if (bLusdGauge === undefined || signer === undefined) {
    throw new Error("unstakeLiquidity() failed: a dependency is null");
  }

  const receipt = await (
    await bLusdGauge.connect(signer)["withdraw(uint256,bool)"](unstakeAmount.hex, true)
  ).wait();

  const withdrawEvent = receipt?.events?.find(e => e?.event === "Withdraw") as Maybe<WithdrawEvent>;

  if (withdrawEvent === undefined) {
    throw new Error("unstakeLiquidity() failed: couldn't find Withdraw event");
  }

  console.log("unstakeLiquidity() finished:", withdrawEvent.args);
  return withdrawEvent.args;
};

const claimLpRewards = async (
  bLusdGauge: CurveLiquidityGaugeV5 | undefined,
  signer: Signer | undefined
): Promise<void> => {
  if (bLusdGauge === undefined || signer === undefined) {
    throw new Error("claimLpRewards() failed: a dependency is null");
  }

  const receipt = await (await bLusdGauge.connect(signer)["claim_rewards()"]()).wait();

  if (!receipt.status) {
    throw new Error("claimLpRewards() failed: no transaction receipt status received.");
  }
};

const getLpRewards = async (
  account: string,
  bLusdGauge: CurveLiquidityGaugeV5
): Promise<BLusdLpRewards> => {
  const rewards: BLusdLpRewards = [];

  const totalRewardTokens = (await bLusdGauge.reward_count()).toNumber();

  for (let tokenIndex = 0; tokenIndex < totalRewardTokens; tokenIndex++) {
    const tokenAddress = await bLusdGauge.reward_tokens(tokenIndex);
    const tokenRewards = decimalify(await bLusdGauge.claimable_reward(account, tokenAddress));
    const tokenName =
      TOKEN_ADDRESS_NAME_MAP[tokenAddress] ||
      `${tokenAddress.slice(0, 5)}..${tokenAddress.slice(tokenAddress.length - 3)}`;

    rewards.push({ name: tokenName, address: tokenAddress, amount: tokenRewards });
  }
  return rewards;
};

export const api = {
  getAccountBonds,
  getStats,
  erc20From,
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
  isTokenApprovedWithBLusdAmmMainnet,
  approveTokenWithBLusdAmm,
  approveTokenWithBLusdAmmMainnet,
  isTokenApprovedWithAmmZapper,
  approveToken,
  getExpectedSwapOutput,
  getExpectedSwapOutputMainnet,
  swapTokens,
  swapTokensMainnet,
  getCoinBalances,
  getExpectedLpTokens,
  addLiquidity,
  getExpectedWithdrawal,
  removeLiquidity,
  removeLiquidityOneCoin,
  stakeLiquidity,
  unstakeLiquidity,
  getLpRewards,
  claimLpRewards
};

export type BondsApi = typeof api;
