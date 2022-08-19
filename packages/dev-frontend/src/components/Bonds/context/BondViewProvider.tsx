import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { BondViewContext, BondViewContextType } from "./BondViewContext";
import type {
  BondStatus,
  Stats,
  BondView,
  BondEvent,
  Payload,
  Bond,
  Treasury,
  BondTransactionStatuses,
  CreateBondPayload,
  ProtocolInfo
} from "./transitions";
import { transitions } from "./transitions";
import { Decimal } from "@liquity/lib-base";
import { useContract } from "../../../hooks/useContract";
import { useLiquity } from "../../../hooks/LiquityContext";
import type { CurveCryptoSwap2ETH } from "@liquity/chicken-bonds/lusd/types/external";
import { CurveCryptoSwap2ETH__factory } from "@liquity/chicken-bonds/lusd/types/external";
import {
  BLUSDToken,
  BondNFT,
  ChickenBondManager,
  ERC20Faucet,
  ERC20Faucet__factory
} from "@liquity/chicken-bonds/lusd/types";
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
import { api } from "./api";
import LUSDTokenAbi from "@liquity/lib-ethers/abi/LUSDToken.json";
import { useTransaction } from "../../../hooks/useTransaction";

const isValidEvent = (view: BondView, event: BondEvent): boolean => {
  return transitions[view][event] !== undefined;
};

const transition = (view: BondView, event: BondEvent): BondView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

export const nfts: Record<BondStatus, string> = {
  PENDING: "./bonds/egg-nft.png",
  CANCELLED: "./bonds/bond-cancelled-dark.png",
  CLAIMED: "./bonds/example-nft-light.gif",
  NON_EXISTENT: ""
};

export const BondViewProvider: React.FC = props => {
  const { children } = props;
  const [view, setView] = useState<BondView>("IDLE");
  const viewRef = useRef<BondView>(view);
  const [selectedBondId, setSelectedBondId] = useState<string>();
  const [optimisticBond, setOptimisticBond] = useState<Bond>();
  const [shouldRefresh, setShouldRefresh] = useState<boolean>(true);
  const [bonds, setBonds] = useState<Bond[]>();
  const [treasury, setTreasury] = useState<Treasury>();
  const [stats, setStats] = useState<Stats>();
  const [protocolInfo, setBLusdInfo] = useState<ProtocolInfo>();
  const [isInfiniteBondApproved, setIsInfiniteBondApproved] = useState(false);
  const [isSynchronising, setIsSynchronising] = useState(true);
  const [statuses, setStatuses] = useState<BondTransactionStatuses>({
    APPROVE: "IDLE",
    CREATE: "IDLE",
    CANCEL: "IDLE",
    CLAIM: "IDLE"
  });
  const [bLusdBalance, setBLusdBalance] = useState<Decimal>();
  const [lusdBalance, setLusdBalance] = useState<Decimal>();

  const { account, liquity } = useLiquity();
  const lusdTokenDefault = useContract<LUSDToken>(
    liquity.connection.addresses.lusdToken,
    LUSDTokenAbi
  );
  const lusdTokenOverride = useContract<ERC20Faucet>(
    LUSD_OVERRIDE_ADDRESS,
    ERC20Faucet__factory.abi
  );

  const lusdToken = (LUSD_OVERRIDE_ADDRESS === null
    ? lusdTokenDefault
    : lusdTokenOverride) as LUSDToken;

  const bondNft = useContract<BondNFT>(BOND_NFT_ADDRESS, BondNFT__factory.abi);
  const chickenBondManager = useContract<ChickenBondManager>(
    CHICKEN_BOND_MANAGER_ADDRESS,
    ChickenBondManager__factory.abi
  );
  const bLusdToken = useContract<BLUSDToken>(BLUSD_TOKEN_ADDRESS, BLUSDToken__factory.abi);
  const bLusdAmm = useContract<CurveCryptoSwap2ETH>(
    BLUSD_AMM_ADDRESS,
    CurveCryptoSwap2ETH__factory.abi
  );

  /***** TODO: REMOVE */
  const getLusdFromFaucet = useCallback(async () => {
    if (
      LUSD_OVERRIDE_ADDRESS !== null &&
      (await lusdToken.balanceOf(account)).eq(0) &&
      "tap" in lusdToken
    ) {
      await (await ((lusdToken as unknown) as ERC20Faucet).tap()).wait();
      setShouldRefresh(true);
    }
  }, [lusdToken, account]);

  useEffect(() => {
    (async () => {
      if (account === undefined || liquity === undefined || lusdToken === undefined) return;

      if (process.env.REACT_APP_DEMO_MODE === "true") {
        if ((await liquity.getTrove(account)).collateral.eq(0)) {
          await liquity.openTrove({ depositCollateral: "11", borrowLUSD: "1800" });
        }
      }
    })();
  }, [account, liquity, lusdToken]);
  /***** /TODO */

  useEffect(() => {
    (async () => {
      if (lusdToken === undefined || account === undefined || isInfiniteBondApproved) return;
      const isApproved = await api.isInfiniteBondApproved(account, lusdToken);
      setIsInfiniteBondApproved(isApproved);
    })();
  }, [lusdToken, account, isInfiniteBondApproved]);

  useEffect(() => {
    (async () => {
      if (
        lusdToken === undefined ||
        bondNft === undefined ||
        chickenBondManager === undefined ||
        bLusdToken === undefined ||
        bLusdAmm === undefined ||
        !shouldRefresh
      ) {
        return;
      }

      setShouldRefresh(false);
      setIsSynchronising(true);

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
      const stats = await api.getStats(bondNft);
      const bLusdBalance = await api.getTokenBalance(account, bLusdToken);
      const lusdBalance = await api.getTokenBalance(account, lusdToken);

      setBLusdInfo(protocolInfo);
      setBLusdBalance(bLusdBalance);
      setLusdBalance(lusdBalance);
      setStats(stats);
      setTreasury(treasury);
      setBonds(bonds);
      setIsSynchronising(false);
      setOptimisticBond(undefined);
    })();
  }, [shouldRefresh, chickenBondManager, bondNft, bLusdToken, lusdToken, account, bLusdAmm]);

  const [approveInfiniteBond, approveStatus] = useTransaction(async () => {
    await api.approveInfiniteBond(lusdToken);
    setIsInfiniteBondApproved(true);
  }, [lusdToken]);

  const [createBond, createStatus] = useTransaction(
    async (lusdAmount: Decimal) => {
      await api.createBond(lusdAmount, chickenBondManager);
      const optimisticBond: Bond = {
        id: "optimistic",
        deposit: lusdAmount,
        startTime: Math.floor(Date.now() / 1000),
        status: "PENDING",
        accrued: Decimal.ZERO,
        tokenUri: "TODO",
        breakEvenTime: Math.floor((Date.now() + 2000000000) / 1000),
        rebondTime: Math.floor((Date.now() + 2700000000) / 1000),
        endTime: 0,
        breakEvenAccrual: Decimal.ZERO,
        rebondAccrual: Decimal.ZERO,
        marketValue: Decimal.ZERO,
        rebondReturn: "0",
        claimNowReturn: "0",
        rebondRoi: Decimal.ZERO
      };
      setOptimisticBond(optimisticBond);
      setShouldRefresh(true);
    },
    [chickenBondManager, lusdToken]
  );

  const [cancelBond, cancelStatus] = useTransaction(
    async (bondId: string, minimumLusd: Decimal) => {
      await api.cancelBond(bondId, minimumLusd, chickenBondManager);
      setShouldRefresh(true);
    },
    [chickenBondManager]
  );

  const [claimBond, claimStatus] = useTransaction(
    async (bondId: string) => {
      await api.claimBond(bondId, chickenBondManager);
      setShouldRefresh(true);
    },
    [chickenBondManager]
  );

  const selectedBond = useMemo(() => bonds?.find(bond => bond.id === selectedBondId), [
    bonds,
    selectedBondId
  ]);

  const dispatchEvent = useCallback(
    async (event: BondEvent, payload?: Payload) => {
      console.log(viewRef.current, event);
      if (!isValidEvent(viewRef.current, event)) return;

      const nextView = transition(viewRef.current, event);
      console.log({ nextView });
      setView(nextView);

      if (payload && "bondId" in payload && payload.bondId !== selectedBondId) {
        setSelectedBondId(payload.bondId);
      }

      const isCurrentViewEvent = (_view: BondView, _event: BondEvent) =>
        viewRef.current === _view && event === _event;

      try {
        if (isCurrentViewEvent("CREATING", "APPROVE_PRESSED")) {
          await approveInfiniteBond();
        } else if (isCurrentViewEvent("CREATING", "CONFIRM_PRESSED")) {
          await createBond((payload as CreateBondPayload).deposit);
          await dispatchEvent("CREATE_BOND_CONFIRMED");
        } else if (isCurrentViewEvent("CANCELLING", "CONFIRM_PRESSED")) {
          if (selectedBond === undefined) {
            console.error(
              "dispatchEvent() handler: attempted to cancel a bond without selecting a bond"
            );
            return;
          }
          await cancelBond(selectedBond.id, selectedBond.deposit);
          await dispatchEvent("CANCEL_BOND_CONFIRMED");
        } else if (isCurrentViewEvent("CLAIMING", "CONFIRM_PRESSED")) {
          if (selectedBond === undefined) {
            console.error(
              "dispatchEvent() handler: attempted to claim a bond without selecting a bond"
            );
            return;
          }
          await claimBond(selectedBond.id);
          await dispatchEvent("CLAIM_BOND_CONFIRMED");
        }
      } catch (error: unknown) {
        console.error("dispatchEvent(), event handler failed\n\n", error);
      }
    },
    [selectedBondId, approveInfiniteBond, createBond, cancelBond, claimBond, selectedBond]
  );

  useEffect(() => {
    setStatuses(statuses => ({
      ...statuses,
      APPROVE: approveStatus,
      CREATE: createStatus,
      CANCEL: cancelStatus,
      CLAIM: claimStatus
    }));
  }, [approveStatus, createStatus, cancelStatus, claimStatus]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const provider: BondViewContextType = {
    view,
    dispatchEvent,
    selectedBondId,
    optimisticBond,
    protocolInfo,
    stats,
    treasury,
    bonds,
    createBond,
    cancelBond,
    claimBond,
    statuses,
    selectedBond,
    bLusdBalance,
    lusdBalance,
    isInfiniteBondApproved,
    isSynchronising,
    getLusdFromFaucet
  };

  // @ts-ignore // TODO REMOVE
  window.bonds = provider;

  return <BondViewContext.Provider value={provider}>{children}</BondViewContext.Provider>;
};
