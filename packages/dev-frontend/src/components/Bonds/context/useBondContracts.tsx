import { Decimal } from "@liquity/lib-base";
import {
  BLUSDLPZap,
  BLUSDLPZap__factory,
  BONEUSDToken,
  BondNFT,
  ChickenBondManager,
  ERC20Faucet,
  ERC20Faucet__factory
} from "@liquity/chicken-bonds/lusd/types";
import {
  CurveCryptoSwap2ETH,
  CurveLiquidityGaugeV5__factory
} from "@liquity/chicken-bonds/lusd/types/external";
import { CurveCryptoSwap2ETH__factory } from "@liquity/chicken-bonds/lusd/types/external";
import {
  BONEUSDToken__factory,
  BondNFT__factory,
  ChickenBondManager__factory
} from "@liquity/chicken-bonds/lusd/types";
import type { ONEUSDToken } from "@liquity/lib-ethers/dist/types";
import ONEUSDTokenAbi from "@liquity/lib-ethers/abi/ONEUSDToken.json";
import { useContract } from "../../../hooks/useContract";
import { useLiquity } from "../../../hooks/LiquityContext";
import { useCallback } from "react";
import type { BondsApi } from "./api";
import type { BLusdLpRewards, Bond, ProtocolInfo, Stats } from "./transitions";
import { BLusdAmmTokenIndex } from "./transitions";
import type { Addresses } from "./transitions";
import { useWeb3React } from "@web3-react/core";
import { useBondAddresses } from "./BondAddressesContext";
import type { CurveLiquidityGaugeV5 } from "@liquity/chicken-bonds/lusd/types/external/CurveLiquidityGaugeV5";

type BondsInformation = {
  protocolInfo: ProtocolInfo;
  bonds: Bond[];
  stats: Stats;
  bLusdBalance: Decimal;
  lusdBalance: Decimal;
  lpTokenBalance: Decimal;
  stakedLpTokenBalance: Decimal;
  lpTokenSupply: Decimal;
  bLusdAmmBLusdBalance: Decimal;
  bLusdAmmLusdBalance: Decimal;
  lpRewards: BLusdLpRewards;
};

type BondContracts = {
  addresses: Addresses;
  oneusdToken: ONEUSDToken | undefined;
  bLusdToken: BONEUSDToken | undefined;
  bondNft: BondNFT | undefined;
  chickenBondManager: ChickenBondManager | undefined;
  bLusdAmm: CurveCryptoSwap2ETH | undefined;
  bLusdAmmZapper: BLUSDLPZap | undefined;
  bLusdGauge: CurveLiquidityGaugeV5 | undefined;
  hasFoundContracts: boolean;
  getLatestData: (account: string, api: BondsApi) => Promise<BondsInformation | undefined>;
};

export const useBondContracts = (): BondContracts => {
  const { liquity } = useLiquity();
  const { chainId } = useWeb3React();
  const isMainnet = chainId === 1;

  const addresses = useBondAddresses();

  const {
    BLUSD_AMM_ADDRESS,
    BLUSD_TOKEN_ADDRESS,
    BOND_NFT_ADDRESS,
    CHICKEN_BOND_MANAGER_ADDRESS,
    LUSD_OVERRIDE_ADDRESS,
    BLUSD_LP_ZAP_ADDRESS,
    BLUSD_AMM_STAKING_ADDRESS
  } = addresses;

  const [lusdTokenDefault, oneusdTokenDefaultStatus] = useContract<ONEUSDToken>(
    liquity.connection.addresses.lusdToken,
    ONEUSDTokenAbi
  );

  const [lusdTokenOverride, oneusdTokenOverrideStatus] = useContract<ERC20Faucet>(
    LUSD_OVERRIDE_ADDRESS,
    ERC20Faucet__factory.abi
  );

  const [lusdToken, oneusdTokenStatus] =
    LUSD_OVERRIDE_ADDRESS === null
      ? [lusdTokenDefault, oneusdTokenDefaultStatus]
      : [(lusdTokenOverride as unknown) as ONEUSDToken, oneusdTokenOverrideStatus];

  const [bLusdToken, bLusdTokenStatus] = useContract<BONEUSDToken>(
    BLUSD_TOKEN_ADDRESS,
    BONEUSDToken__factory.abi
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

  const [bLusdAmmZapper, bLusAmmZapperStatus] = useContract<BLUSDLPZap>(
    BLUSD_LP_ZAP_ADDRESS,
    BLUSDLPZap__factory.abi
  );

  const [bLusdGauge, bLusdGaugeStatus] = useContract<CurveLiquidityGaugeV5>(
    BLUSD_AMM_STAKING_ADDRESS,
    CurveLiquidityGaugeV5__factory.abi
  );

  const hasFoundContracts =
    [
      oneusdTokenStatus,
      bondNftStatus,
      chickenBondManagerStatus,
      bLusdTokenStatus,
      bLusdAmmStatus,
      bLusAmmZapperStatus,
      bLusdGaugeStatus
    ].find(status => status === "FAILED") === undefined;

  const getLatestData = useCallback(
    async (account: string, api: BondsApi): Promise<BondsInformation | undefined> => {
      if (
        oneusdToken === undefined ||
        bondNft === undefined ||
        chickenBondManager === undefined ||
        bLusdToken === undefined ||
        bLusdAmm === undefined ||
        bLusdGauge === undefined ||
        BLUSD_AMM_STAKING_ADDRESS === null
      ) {
        return undefined;
      }

      const protocolInfoPromise = api.getProtocolInfo(
        bLusdToken,
        bLusdAmm,
        chickenBondManager,
        isMainnet
      );

      const bondsPromise = api.getAccountBonds(
        account,
        bondNft,
        chickenBondManager,
        await protocolInfoPromise
      );

      const [protocolInfo, stats, lpToken, lpStakingContract] = await Promise.all([
        protocolInfoPromise,
        api.getStats(chickenBondManager),
        api.getLpToken(bLusdAmm),
        api.erc20From(BLUSD_AMM_STAKING_ADDRESS, bLusdAmm.provider)
      ]);

      const [
        bLusdBalance,
        lusdBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bLusdAmmCoinBalances,
        lpRewards
      ] = await Promise.all([
        api.getTokenBalance(account, bLusdToken),
        api.getTokenBalance(account, oneusdToken),
        api.getTokenBalance(account, lpToken),
        api.getTokenBalance(account, lpStakingContract),
        api.getTokenTotalSupply(lpToken),
        api.getCoinBalances(bLusdAmm),
        api.getLpRewards(account, bLusdGauge)
      ]);

      const bonds = await bondsPromise;

      return {
        protocolInfo,
        bonds,
        stats,
        bLusdBalance,
        lusdBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bLusdAmmBLusdBalance: bLusdAmmCoinBalances[BLusdAmmTokenIndex.BLUSD],
        bLusdAmmLusdBalance: bLusdAmmCoinBalances[BLusdAmmTokenIndex.LUSD],
        lpRewards
      };
    },
    [
      chickenBondManager,
      bondNft,
      bLusdToken,
      oneusdToken,
      bLusdAmm,
      isMainnet,
      BLUSD_AMM_STAKING_ADDRESS,
      bLusdGauge
    ]
  );

  return {
    addresses,
    oneusdToken,
    bLusdToken,
    bondNft,
    chickenBondManager,
    bLusdAmm,
    bLusdAmmZapper,
    bLusdGauge,
    getLatestData,
    hasFoundContracts
  };
};
