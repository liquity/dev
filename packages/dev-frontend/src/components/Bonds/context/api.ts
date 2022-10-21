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
import { splitSignature } from "ethers/lib/utils";
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
import type { ProtocolInfo, Bond, BondStatus, Stats, ClaimedBonds, Maybe } from "./transitions";
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
import type { EthersSigner } from "@liquity/lib-ethers";
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
};
let cachedYearnApys: CachedYearnApys = {
  lusd3Crv: undefined,
  stabilityPool: undefined
};

type YearnVault = Partial<{
  token: {
    address: string;
  };
  apy: {
    net_apy: number;
  };
}>;

const cacheYearnVaultApys = async (): Promise<void> => {
  try {
    if (cachedYearnApys.lusd3Crv !== undefined) return;

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

    cachedYearnApys.lusd3Crv = Decimal.from(lusd3CrvVault.apy.net_apy);
    cachedYearnApys.stabilityPool = Decimal.from(stabilityPoolVault.apy.net_apy);
  } catch (error: unknown) {
    console.error(error);
  }
};

const getClaimedBonds = async (
  account: string,
  chickenBondManager: ChickenBondManager
): Promise<ClaimedBonds> => {
  const claimedBondsFilter = await chickenBondManager.filters.BondClaimed(account);
  const events = await chickenBondManager.queryFilter(claimedBondsFilter);
  const claimedBonds = events.reduce((accumulator, current) => {
    const { bondId, bLusdAmount } = current.args;
    return {
      ...accumulator,
      [bondId.toNumber().toString()]: decimalify(bLusdAmount)
    };
  }, {});

  return claimedBonds;
};

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
  try {
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
    const claimedBonds = await getClaimedBonds(account, chickenBondManager);

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
        const claimedAmount = claimedBonds[id];

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
            claimedAmount
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
  const bLusdSupply = decimalify(await bLusdToken.totalSupply());
  const marketPrice = isMainnet
    ? await getBlusdAmmPriceMainnet(bLusdAmm)
    : await getBlusdAmmPrice(bLusdAmm);
  const [pending, reserve, permanent] = await chickenBondManager.getTreasury();

  const treasury = {
    pending: decimalify(pending),
    reserve: decimalify(reserve),
    permanent: decimalify(permanent),
    total: decimalify(pending.add(reserve).add(permanent))
  };

  if (cachedYearnApys.lusd3Crv === undefined || cachedYearnApys.stabilityPool === undefined) {
    await cacheYearnVaultApys();
  }

  let yieldAmplification: Maybe<Decimal> = undefined;
  let bLusdApr: Maybe<Decimal> = undefined;

  const protocolOwnedLusdInStabilityPool = decimalify(await chickenBondManager.getOwnedLUSDInSP());
  const protocolLusdInStabilityPool = treasury.pending.add(protocolOwnedLusdInStabilityPool);
  const protocolLusdInCurve = decimalify(await chickenBondManager.getTotalLUSDInCurve());

  const fairPrice = {
    lower: treasury.total.sub(treasury.pending).div(bLusdSupply),
    upper: treasury.total.div(bLusdSupply)
  };

  if (
    cachedYearnApys.lusd3Crv !== undefined &&
    cachedYearnApys.stabilityPool !== undefined &&
    treasury.reserve.gt(0)
  ) {
    const protocolStabilityPoolYield = cachedYearnApys.stabilityPool.mul(
      protocolLusdInStabilityPool
    );
    const protocolCurveYield = cachedYearnApys.lusd3Crv.mul(protocolLusdInCurve);
    bLusdApr = protocolStabilityPoolYield.add(protocolCurveYield).div(treasury.reserve);
    yieldAmplification = bLusdApr.div(cachedYearnApys.stabilityPool);

    fairPrice.lower = protocolLusdInStabilityPool
      .sub(treasury.pending)
      .add(protocolLusdInCurve.mul(cachedYearnApys.lusd3Crv.div(cachedYearnApys.stabilityPool)))
      .div(bLusdSupply);

    fairPrice.upper = protocolLusdInStabilityPool
      .add(protocolLusdInCurve.mul(cachedYearnApys.lusd3Crv.div(cachedYearnApys.stabilityPool)))
      .div(bLusdSupply);
  }

  const floorPrice = bLusdSupply.isZero ? Decimal.ONE : treasury.reserve.div(bLusdSupply);
  const claimBondFee = decimalify(await chickenBondManager.CHICKEN_IN_AMM_FEE());
  const alphaAccrualFactor = decimalify(await chickenBondManager.calcUpdatedAccrualParameter()).div(
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
    treasury,
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
    simulatedMarketPrice,
    yieldAmplification,
    bLusdApr
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

const createBond = async (
  lusdAmount: Decimal,
  owner: string,
  lusdAddress: string,
  lusdToken: LUSDToken | undefined,
  chickenBondManager: ChickenBondManager | undefined,
  signer: EthersSigner
): Promise<BondCreatedEventObject> => {
  if (chickenBondManager === undefined || lusdToken === undefined) {
    throw new Error("createBond() failed: a dependency is null");
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

const cancelBond = async (
  bondId: string,
  minimumLusd: Decimal,
  chickenBondManager: ChickenBondManager | undefined
): Promise<BondCancelledEventObject> => {
  if (chickenBondManager === undefined) throw new Error("cancelBond() failed: a dependency is null");
  console.log("cancelBond() started:", bondId, minimumLusd.toString());

  const gasEstimate = await chickenBondManager.estimateGas.chickenOut(bondId, minimumLusd.hex);

  const receipt = await (
    await chickenBondManager.chickenOut(bondId, minimumLusd.hex, {
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
  chickenBondManager: ChickenBondManager | undefined
): Promise<BondClaimedEventObject> => {
  try {
    if (chickenBondManager === undefined)
      throw new Error("claimBond() failed: a dependency is null");
    console.log("claimBond() started", bondId);

    const gasEstimate = await chickenBondManager.estimateGas.chickenIn(bondId);

    const receipt = await (
      await chickenBondManager.chickenIn(bondId, {
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
  bLusdAmmAddress: string | null
) => {
  if (token === undefined || bLusdAmmAddress === null) {
    throw new Error("approveTokenWithBLusdAmm() failed: a dependency is null");
  }

  await (await token.approve(bLusdAmmAddress, constants.MaxUint256)).wait();
  return;
};

const approveToken = async (
  token: LUSDToken | BLUSDToken | ERC20 | undefined,
  spenderAddress: string | null
) => {
  if (token === undefined || spenderAddress === null) {
    throw new Error("approveToken() failed: a dependency is null");
  }

  await (await token.approve(spenderAddress, constants.MaxUint256)).wait();
  return;
};

const approveTokenWithBLusdAmmMainnet = async (token: LUSDToken | BLUSDToken | undefined) => {
  if (token === undefined) {
    throw new Error("approveTokenWithBLusdAmmMainnet() failed: a dependency is null");
  }

  await (await token.approve(CURVE_REGISTRY_SWAPS_ADDRESS, constants.MaxUint256)).wait();
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

  const swaps = CurveRegistrySwaps__factory.connect(CURVE_REGISTRY_SWAPS_ADDRESS, bLusdAmm.signer);

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
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<TokenExchangeEventObject> => {
  if (bLusdAmm === undefined) throw new Error("swapTokens() failed: a dependency is null");

  const gasEstimate = await bLusdAmm.estimateGas["exchange(uint256,uint256,uint256,uint256)"](
    inputToken,
    getOtherToken(inputToken),
    inputAmount.hex,
    minOutputAmount.hex
  );

  const receipt = await (
    await bLusdAmm["exchange(uint256,uint256,uint256,uint256)"](
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
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<void> => {
  if (bLusdAmm === undefined) throw new Error("swapTokensMainnet() failed: a dependency is null");

  const swaps = CurveRegistrySwaps__factory.connect(CURVE_REGISTRY_SWAPS_ADDRESS, bLusdAmm.signer);
  const route = getRoute(inputToken);

  const gasEstimate = await swaps.estimateGas[
    "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"
  ](...route, inputAmount.hex, minOutputAmount.hex);

  const receipt = await (
    await swaps["exchange_multiple(address[9],uint256[3][4],uint256,uint256)"](
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
    // If the user is depositing bLUSD single sided, they won't have approved any.. TODO
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
  bLusdZapper: BLUSDLPZap | undefined
): Promise<void> => {
  if (bLusdZapper === undefined) throw new Error("addLiquidity() failed: a dependency is null");

  const zapperFunction = shouldStakeInGauge ? "addLiquidityAndStake" : "addLiquidity";

  const gasEstimate = await bLusdZapper.estimateGas[zapperFunction](
    bLusdAmount.hex,
    lusdAmount.hex,
    minLpTokens.hex
  );

  const receipt = await (
    await bLusdZapper[zapperFunction](
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
  bLusdZapper: BLUSDLPZap | undefined
): Promise<void> => {
  if (bLusdZapper === undefined) throw new Error("removeLiquidity() failed: a dependency is null");

  const receipt = await (
    await bLusdZapper.removeLiquidityBalanced(
      burnLpTokens.hex,
      minBLusdAmount.hex,
      minLusdAmount.hex
    )
  ).wait();

  if (!receipt.status) {
    throw new Error("removeLiquidity() failed");
  }

  console.log("removeLiquidity() finished");
};

const removeLiquidityLUSD = async (
  burnLpTokens: Decimal,
  minAmount: Decimal,
  bLusdZapper: BLUSDLPZap | undefined
): Promise<void> => {
  if (bLusdZapper === undefined)
    throw new Error("removeLiquidityLUSD() failed: a dependency is null");

  const removeLiquidityFunction = "removeLiquidityLUSD";

  const gasEstimate = await bLusdZapper.estimateGas[removeLiquidityFunction](
    burnLpTokens.hex,
    minAmount.hex
  );

  const receipt = await (
    await bLusdZapper[removeLiquidityFunction](
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
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<void> => {
  if (bLusdAmm === undefined) throw new Error("removeLiquidityBLUSD() failed: a dependency is null");

  const removeLiquidityFunction = "remove_liquidity_one_coin(uint256,uint256,uint256,bool)";

  const gasEstimate = await bLusdAmm.estimateGas[removeLiquidityFunction](
    burnLpTokens.hex,
    0,
    minAmount.hex,
    false
  );

  const receipt = await (
    await bLusdAmm[removeLiquidityFunction](
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
  bLusdAmm: CurveCryptoSwap2ETH | undefined
): Promise<void> => {
  if (output === BLusdAmmTokenIndex.LUSD) {
    return removeLiquidityLUSD(burnLpTokens, minAmount, bLusdZapper);
  } else {
    return removeLiquidityBLUSD(burnLpTokens, minAmount, bLusdAmm);
  }
};

const stakeLiquidity = async (
  stakeAmount: Decimal,
  bLusdGauge: CurveLiquidityGaugeV5 | undefined
): Promise<DepositEventObject> => {
  if (bLusdGauge === undefined) {
    throw new Error("stakeLiquidity() failed: a dependency is null");
  }
  const receipt = await (await bLusdGauge["deposit(uint256)"](stakeAmount.hex)).wait();

  const depositEvent = receipt?.events?.find(e => e?.event === "Deposit") as Maybe<DepositEvent>;

  if (depositEvent === undefined) {
    throw new Error("stakeLiquidity() failed: couldn't find Withdraw event");
  }

  console.log("stakeLiquidity() finished:", depositEvent.args);
  return depositEvent.args;
};

const unstakeLiquidity = async (
  unstakeAmount: Decimal,
  bLusdGauge: CurveLiquidityGaugeV5 | undefined
): Promise<WithdrawEventObject> => {
  if (bLusdGauge === undefined) {
    throw new Error("unstakeLiquidity() failed: a dependency is null");
  }
  const claimRewards = true;
  const receipt = await (
    await bLusdGauge["withdraw(uint256,bool)"](unstakeAmount.hex, claimRewards)
  ).wait();

  const withdrawEvent = receipt?.events?.find(e => e?.event === "Withdraw") as Maybe<WithdrawEvent>;

  if (withdrawEvent === undefined) {
    throw new Error("unstakeLiquidity() failed: couldn't find Withdraw event");
  }

  console.log("unstakeLiquidity() finished:", withdrawEvent.args);
  return withdrawEvent.args;
};

export const api = {
  getAccountBonds,
  getStats,
  erc20From,
  getLpToken,
  getTokenBalance,
  getTokenTotalSupply,
  getProtocolInfo,
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
  unstakeLiquidity
};

export type BondsApi = typeof api;
