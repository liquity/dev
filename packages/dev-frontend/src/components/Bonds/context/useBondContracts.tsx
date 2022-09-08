import type { Decimal } from "@liquity/lib-base";
import {
  BLUSDToken,
  BondNFT,
  ChickenBondManager,
  ERC20Faucet,
  ERC20Faucet__factory
} from "@liquity/chicken-bonds/lusd/types";
import type { CurveCryptoSwap2ETH } from "@liquity/chicken-bonds/lusd/types/external";
import { CurveCryptoSwap2ETH__factory } from "@liquity/chicken-bonds/lusd/types/external";
import {
  BLUSDToken__factory,
  BondNFT__factory,
  ChickenBondManager__factory
} from "@liquity/chicken-bonds/lusd/types";
import {
  BLUSD_AMM_ADDRESS,
  BLUSD_TOKEN_ADDRESS,
  BOND_NFT_ADDRESS,
  CHICKEN_BOND_MANAGER_ADDRESS,
  LUSD_OVERRIDE_ADDRESS
} from "@liquity/chicken-bonds/lusd/addresses";
import type { LUSDToken } from "@liquity/lib-ethers/dist/types";
import LUSDTokenAbi from "@liquity/lib-ethers/abi/LUSDToken.json";
import { useContract } from "../../../hooks/useContract";
import { useLiquity } from "../../../hooks/LiquityContext";
import { useCallback } from "react";
import type { BondsApi } from "./api";
import type { Bond, ProtocolInfo, Stats, Treasury } from "./transitions";
import { BLusdAmmTokenIndex } from "./transitions";

type BondsInformation = {
  treasury: Treasury;
  protocolInfo: ProtocolInfo;
  bonds: Bond[];
  stats: Stats;
  bLusdBalance: Decimal;
  lusdBalance: Decimal;
  lpTokenBalance: Decimal;
  lpTokenSupply: Decimal;
  bLusdAmmBLusdBalance: Decimal;
  bLusdAmmLusdBalance: Decimal;
};

type BondContracts = {
  lusdToken: LUSDToken | undefined;
  bLusdToken: BLUSDToken | undefined;
  bondNft: BondNFT | undefined;
  chickenBondManager: ChickenBondManager | undefined;
  bLusdAmm: CurveCryptoSwap2ETH | undefined;
  hasFoundContracts: boolean;
  getLatestData: (account: string, api: BondsApi) => Promise<BondsInformation | undefined>;
};

export const useBondContracts = (): BondContracts => {
  const { liquity } = useLiquity();

  const [lusdTokenDefault, lusdTokenDefaultStatus] = useContract<LUSDToken>(
    liquity.connection.addresses.lusdToken,
    LUSDTokenAbi
  );
  const [lusdTokenOverride, lusdTokenOverrideStatus] = useContract<ERC20Faucet>(
    LUSD_OVERRIDE_ADDRESS,
    ERC20Faucet__factory.abi
  );

  const [lusdToken, lusdTokenStatus] =
    LUSD_OVERRIDE_ADDRESS === null
      ? [lusdTokenDefault, lusdTokenDefaultStatus]
      : [(lusdTokenOverride as unknown) as LUSDToken, lusdTokenOverrideStatus];

  const [bLusdToken, bLusdTokenStatus] = useContract<BLUSDToken>(
    BLUSD_TOKEN_ADDRESS,
    BLUSDToken__factory.abi
  );

  const [bondNft, bondNftStatus] = useContract<BondNFT>(BOND_NFT_ADDRESS, BondNFT__factory.abi);
  const [chickenBondManager, chickenBondManagerStatus] = useContract<ChickenBondManager>(
    CHICKEN_BOND_MANAGER_ADDRESS,
    ChickenBondManager__factory.abi
  );

  const [bLusdAmm, bLusdAmmStatus] = useContract<CurveCryptoSwap2ETH>(
    BLUSD_AMM_ADDRESS,
    CurveCryptoSwap2ETH__factory.abi
  );

  const hasFoundContracts =
    [
      lusdTokenStatus,
      bondNftStatus,
      chickenBondManagerStatus,
      bLusdTokenStatus,
      bLusdAmmStatus
    ].find(status => status === "FAILED") === undefined;

  const getLatestData = useCallback(
    async (account: string, api: BondsApi) => {
      if (
        lusdToken === undefined ||
        bondNft === undefined ||
        chickenBondManager === undefined ||
        bLusdToken === undefined ||
        bLusdAmm === undefined
      ) {
        return;
      }

      const treasury = await api.getTreasury(chickenBondManager);
      const protocolInfo = await api.getProtocolInfo(
        bLusdToken,
        bLusdAmm,
        chickenBondManager,
        treasury.reserve
      );
      const bonds = await api.getAccountBonds(
        account,
        bondNft,
        chickenBondManager,
        protocolInfo.marketPrice,
        protocolInfo.alphaAccrualFactor,
        protocolInfo.marketPricePremium,
        protocolInfo.claimBondFee,
        protocolInfo.floorPrice
      );
      const stats = await api.getStats(chickenBondManager);

      // TODO cache LP token? Or add to addresses.json?
      const lpToken = await api.getLpToken(bLusdAmm);

      const [
        bLusdBalance,
        lusdBalance,
        lpTokenBalance,
        lpTokenSupply,
        bLusdAmmCoinBalances
      ] = await Promise.all([
        api.getTokenBalance(account, bLusdToken),
        api.getTokenBalance(account, lusdToken),
        api.getTokenBalance(account, lpToken),
        api.getTokenTotalSupply(lpToken),
        api.getCoinBalances(bLusdAmm)
      ]);

      return {
        treasury,
        protocolInfo,
        bonds,
        stats,
        bLusdBalance,
        lusdBalance,
        lpTokenBalance,
        lpTokenSupply,
        bLusdAmmBLusdBalance: bLusdAmmCoinBalances[BLusdAmmTokenIndex.BLUSD],
        bLusdAmmLusdBalance: bLusdAmmCoinBalances[BLusdAmmTokenIndex.LUSD]
      };
    },
    [chickenBondManager, bondNft, bLusdToken, lusdToken, bLusdAmm]
  );

  return {
    lusdToken,
    bLusdToken,
    bondNft,
    chickenBondManager,
    bLusdAmm,
    getLatestData,
    hasFoundContracts
  };
};
