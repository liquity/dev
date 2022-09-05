import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { BondViewContext, BondViewContextType } from "./BondViewContext";
import type {
  Stats,
  BondView,
  BondEvent,
  Payload,
  Bond,
  Treasury,
  BondTransactionStatuses,
  CreateBondPayload,
  ProtocolInfo,
  OptimisticBond
} from "./transitions";
import { transitions } from "./transitions";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";
import { api, _getProtocolInfo } from "./api";
import { useTransaction } from "../../../hooks/useTransaction";
import { AppLoader } from "../../AppLoader";
import { LUSD_OVERRIDE_ADDRESS } from "@liquity/chicken-bonds/lusd/addresses";
import type { ERC20Faucet } from "@liquity/chicken-bonds/lusd/types";
import { useBondContracts } from "./useBondContracts";

// Refresh backend values every 15 seconds
const SYNCHRONIZE_INTERVAL_MS = 15 * 1000;

const isValidEvent = (view: BondView, event: BondEvent): boolean => {
  return transitions[view][event] !== undefined;
};

const transition = (view: BondView, event: BondEvent): BondView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

export const EXAMPLE_NFT = "./bonds/egg-nft.png";

export const BondViewProvider: React.FC = props => {
  const { children } = props;
  const [view, setView] = useState<BondView>("IDLE");
  const viewRef = useRef<BondView>(view);
  const [selectedBondId, setSelectedBondId] = useState<string>();
  const [optimisticBond, setOptimisticBond] = useState<OptimisticBond>();
  const [shouldSynchronize, setShouldSynchronize] = useState<boolean>(true);
  const [bonds, setBonds] = useState<Bond[]>();
  const [treasury, setTreasury] = useState<Treasury>();
  const [stats, setStats] = useState<Stats>();
  const [protocolInfo, setProtocolInfo] = useState<ProtocolInfo>();
  const [simulatedProtocolInfo, setSimulatedProtocolInfo] = useState<ProtocolInfo>();
  const [isInfiniteBondApproved, setIsInfiniteBondApproved] = useState(false);
  const [isSynchronizing, setIsSynchronizing] = useState(true);
  const [statuses, setStatuses] = useState<BondTransactionStatuses>({
    APPROVE: "IDLE",
    CREATE: "IDLE",
    CANCEL: "IDLE",
    CLAIM: "IDLE"
  });
  const [bLusdBalance, setBLusdBalance] = useState<Decimal>();
  const [lusdBalance, setLusdBalance] = useState<Decimal>();
  const { account, liquity } = useLiquity();
  const contracts = useBondContracts();

  const setSimulatedMarketPrice = useCallback(
    (marketPrice: Decimal) => {
      if (protocolInfo === undefined) return;
      const simulatedProtocolInfo = _getProtocolInfo(
        marketPrice,
        protocolInfo.floorPrice,
        protocolInfo.claimBondFee,
        protocolInfo.alphaAccrualFactor
      );

      setSimulatedProtocolInfo({
        ...protocolInfo,
        ...simulatedProtocolInfo,
        simulatedMarketPrice: marketPrice
      });
    },
    [protocolInfo]
  );

  const resetSimulatedMarketPrice = useCallback(() => {
    if (protocolInfo === undefined) return;

    setSimulatedProtocolInfo({ ...protocolInfo });
  }, [protocolInfo]);

  const removeBondFromList = useCallback(
    (bondId: string) => {
      if (bonds === undefined) return;
      const idx = bonds.findIndex(bond => bond.id === bondId);
      const nextBonds = bonds.slice(0, idx).concat(bonds.slice(idx + 1));
      setBonds(nextBonds);
    },
    [bonds]
  );

  const changeBondStatusToClaimed = useCallback(
    (bondId: string) => {
      if (bonds === undefined) return;
      const idx = bonds.findIndex(bond => bond.id === bondId);
      const updatedBond: Bond = { ...bonds[idx], status: "CLAIMED" };
      const nextBonds = bonds
        .slice(0, idx)
        .concat(updatedBond)
        .concat(bonds.slice(idx + 1));
      setBonds(nextBonds);
    },
    [bonds]
  );

  /***** TODO: REMOVE */
  const getLusdFromFaucet = useCallback(async () => {
    if (contracts.lusdToken === undefined) return;
    if (
      LUSD_OVERRIDE_ADDRESS !== null &&
      (await contracts.lusdToken.balanceOf(account)).eq(0) &&
      "tap" in contracts.lusdToken
    ) {
      await (await ((contracts.lusdToken as unknown) as ERC20Faucet).tap()).wait();
      setShouldSynchronize(true);
    }
  }, [contracts.lusdToken, account]);

  useEffect(() => {
    (async () => {
      if (account === undefined || liquity === undefined || contracts.lusdToken === undefined)
        return;

      if (process.env.REACT_APP_DEMO_MODE === "true") {
        if ((await liquity.getTrove(account)).collateral.eq(0)) {
          await liquity.openTrove({ depositCollateral: "11", borrowLUSD: "1800" });
        }
      }
    })();
  }, [account, liquity, contracts.lusdToken]);

  useEffect(() => {
    (async () => {
      if (contracts.lusdToken === undefined || account === undefined || isInfiniteBondApproved)
        return;
      const isApproved = await api.isInfiniteBondApproved(account, contracts.lusdToken);
      setIsInfiniteBondApproved(isApproved);
    })();
  }, [contracts.lusdToken, account, isInfiniteBondApproved]);
  /***** /TODO */

  useEffect(() => {
    if (isSynchronizing) return;
    const timer = setTimeout(() => setShouldSynchronize(true), SYNCHRONIZE_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isSynchronizing]);

  useEffect(() => {
    (async () => {
      try {
        if (
          contracts.lusdToken === undefined ||
          contracts.bondNft === undefined ||
          contracts.chickenBondManager === undefined ||
          contracts.bLusdToken === undefined ||
          contracts.bLusdAmm === undefined ||
          !shouldSynchronize
        ) {
          return;
        }

        setShouldSynchronize(false);
        setIsSynchronizing(true);

        const latest = await contracts.getLatestData(account, api);
        if (latest === undefined) {
          setIsSynchronizing(false);
          return;
        }

        const { treasury, protocolInfo, bonds, stats, bLusdBalance, lusdBalance } = latest;

        setProtocolInfo(protocolInfo);

        // Don't change the simualted price if we already have one since only the user should change it
        if (simulatedProtocolInfo === undefined) {
          const simulatedProtocolInfo = _getProtocolInfo(
            protocolInfo.simulatedMarketPrice,
            protocolInfo.floorPrice,
            protocolInfo.claimBondFee,
            protocolInfo.alphaAccrualFactor
          );
          setSimulatedProtocolInfo({ ...protocolInfo, ...simulatedProtocolInfo });
        }

        setBLusdBalance(bLusdBalance);
        setLusdBalance(lusdBalance);
        setStats(stats);
        setTreasury(treasury);
        setBonds(bonds);
        setIsSynchronizing(false);
        setOptimisticBond(undefined);
      } catch (error: unknown) {
        console.error("Caught exception", error);
      }
    })();
  }, [shouldSynchronize, account, contracts, simulatedProtocolInfo]);

  const [approveInfiniteBond, approveStatus] = useTransaction(async () => {
    await api.approveInfiniteBond(contracts.lusdToken);
    setIsInfiniteBondApproved(true);
  }, [contracts.lusdToken]);

  const [createBond, createStatus] = useTransaction(
    async (lusdAmount: Decimal) => {
      await api.createBond(lusdAmount, contracts.chickenBondManager);
      const optimisticBond: OptimisticBond = {
        id: "OPTIMISTIC_BOND",
        deposit: lusdAmount,
        startTime: Date.now(),
        status: "PENDING"
      };
      setOptimisticBond(optimisticBond);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, contracts.lusdToken]
  );

  const [cancelBond, cancelStatus] = useTransaction(
    async (bondId: string, minimumLusd: Decimal) => {
      await api.cancelBond(bondId, minimumLusd, contracts.chickenBondManager);
      removeBondFromList(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, removeBondFromList]
  );

  const [claimBond, claimStatus] = useTransaction(
    async (bondId: string) => {
      await api.claimBond(bondId, contracts.chickenBondManager);
      changeBondStatusToClaimed(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, changeBondStatusToClaimed]
  );

  const selectedBond = useMemo(() => bonds?.find(bond => bond.id === selectedBondId), [
    bonds,
    selectedBondId
  ]);

  const dispatchEvent = useCallback(
    async (event: BondEvent, payload?: Payload) => {
      if (!isValidEvent(viewRef.current, event)) return;

      const nextView = transition(viewRef.current, event);
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
    isSynchronizing,
    getLusdFromFaucet,
    setSimulatedMarketPrice,
    resetSimulatedMarketPrice,
    simulatedProtocolInfo,
    hasFoundContracts: contracts.hasFoundContracts
  };

  // @ts-ignore // TODO REMOVE
  window.bonds = provider;

  // If contracts don't load it means they're not deployed, we shouldn't block the app from running in this case
  if (protocolInfo === undefined && contracts.hasFoundContracts) return <AppLoader />;

  return <BondViewContext.Provider value={provider}>{children}</BondViewContext.Provider>;
};
