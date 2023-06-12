import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { BondViewContext, BondViewContextType } from "./BondViewContext";
import type {
  Stats,
  BondView,
  BondEvent,
  Payload,
  Bond,
  BondTransactionStatuses,
  CreateBondPayload,
  ProtocolInfo,
  OptimisticBond,
  SwapPayload,
  ApprovePressedPayload,
  ManageLiquidityPayload,
  BLusdLpRewards
} from "./transitions";
import { BLusdAmmTokenIndex } from "./transitions";
import { transitions } from "./transitions";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";
import { api, _getProtocolInfo } from "./api";
import { useTransaction } from "../../../hooks/useTransaction";
import type { ERC20Faucet } from "@liquity/chicken-bonds/lusd/types";
import { useBondContracts } from "./useBondContracts";
import { useChainId } from "wagmi";
import { useBondAddresses } from "./BondAddressesContext";

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
  const [stats, setStats] = useState<Stats>();
  const [protocolInfo, setProtocolInfo] = useState<ProtocolInfo>();
  const [simulatedProtocolInfo, setSimulatedProtocolInfo] = useState<ProtocolInfo>();
  const [isInfiniteBondApproved, setIsInfiniteBondApproved] = useState(false);
  const [lpRewards, setLpRewards] = useState<BLusdLpRewards>();
  const [isLusdApprovedWithBlusdAmm, setIsLusdApprovedWithBlusdAmm] = useState(false);
  const [isBLusdApprovedWithBlusdAmm, setIsBLusdApprovedWithBlusdAmm] = useState(false);
  const [isLusdApprovedWithAmmZapper, setIsLusdApprovedWithAmmZapper] = useState(false);
  const [isBLusdApprovedWithAmmZapper, setIsBLusdApprovedWithAmmZapper] = useState(false);
  const [isBLusdLpApprovedWithAmmZapper, setIsBLusdLpApprovedWithAmmZapper] = useState(false);
  const [isBLusdLpApprovedWithGauge, setIsBLusdLpApprovedWithGauge] = useState(false);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [inputToken, setInputToken] = useState<BLusdAmmTokenIndex.BLUSD | BLusdAmmTokenIndex.LUSD>(
    BLusdAmmTokenIndex.BLUSD
  );
  const [statuses, setStatuses] = useState<BondTransactionStatuses>({
    APPROVE: "IDLE",
    CREATE: "IDLE",
    CANCEL: "IDLE",
    CLAIM: "IDLE",
    APPROVE_AMM: "IDLE",
    APPROVE_SPENDER: "IDLE",
    SWAP: "IDLE",
    MANAGE_LIQUIDITY: "IDLE"
  });
  const [bLusdBalance, setBLusdBalance] = useState<Decimal>();
  const [lusdBalance, setLusdBalance] = useState<Decimal>();
  const [lpTokenBalance, setLpTokenBalance] = useState<Decimal>();
  const [stakedLpTokenBalance, setStakedLpTokenBalance] = useState<Decimal>();

  const [lpTokenSupply, setLpTokenSupply] = useState<Decimal>();
  const [bLusdAmmBLusdBalance, setBLusdAmmBLusdBalance] = useState<Decimal>();
  const [bLusdAmmLusdBalance, setBLusdAmmLusdBalance] = useState<Decimal>();
  const [isBootstrapPeriodActive, setIsBootstrapPeriodActive] = useState<boolean>();
  const { account, liquity } = useLiquity();
  const {
    LUSD_OVERRIDE_ADDRESS,
    BLUSD_AMM_ADDRESS,
    BLUSD_LP_ZAP_ADDRESS,
    BLUSD_AMM_STAKING_ADDRESS
  } = useBondAddresses();
  const contracts = useBondContracts();
  const chainId = useChainId();
  const isMainnet = chainId === 1;

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

  const getLusdFromFaucet = useCallback(async () => {
    if (contracts.lusdToken === undefined || liquity.connection.signer === undefined) return;

    if (
      LUSD_OVERRIDE_ADDRESS !== null &&
      (await contracts.lusdToken.balanceOf(account)).eq(0) &&
      "tap" in contracts.lusdToken
    ) {
      await (
        await ((contracts.lusdToken as unknown) as ERC20Faucet)
          .connect(liquity.connection.signer)
          .tap()
      ).wait();
      setShouldSynchronize(true);
    }
  }, [contracts.lusdToken, account, LUSD_OVERRIDE_ADDRESS, liquity.connection.signer]);

  useEffect(() => {
    (async () => {
      if (
        contracts.lusdToken === undefined ||
        contracts.chickenBondManager === undefined ||
        account === undefined ||
        isInfiniteBondApproved
      )
        return;
      const isApproved = await api.isInfiniteBondApproved(
        account,
        contracts.lusdToken,
        contracts.chickenBondManager
      );
      setIsInfiniteBondApproved(isApproved);
    })();
  }, [contracts.lusdToken, contracts.chickenBondManager, account, isInfiniteBondApproved]);

  useEffect(() => {
    (async () => {
      if (
        BLUSD_AMM_ADDRESS === null ||
        contracts.lusdToken === undefined ||
        isLusdApprovedWithBlusdAmm
      ) {
        return;
      }
      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBLusdAmmMainnet(account, contracts.lusdToken)
        : api.isTokenApprovedWithBLusdAmm(account, contracts.lusdToken, BLUSD_AMM_ADDRESS));

      setIsLusdApprovedWithBlusdAmm(isApproved);
    })();
  }, [contracts.lusdToken, account, isLusdApprovedWithBlusdAmm, isMainnet, BLUSD_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BLUSD_AMM_ADDRESS === null ||
        contracts.bLusdToken === undefined ||
        isBLusdApprovedWithBlusdAmm
      ) {
        return;
      }

      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBLusdAmmMainnet(account, contracts.bLusdToken)
        : api.isTokenApprovedWithBLusdAmm(account, contracts.bLusdToken, BLUSD_AMM_ADDRESS));

      setIsBLusdApprovedWithBlusdAmm(isApproved);
    })();
  }, [contracts.bLusdToken, account, isBLusdApprovedWithBlusdAmm, isMainnet, BLUSD_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BLUSD_LP_ZAP_ADDRESS === null ||
        contracts.lusdToken === undefined ||
        isLusdApprovedWithAmmZapper
      ) {
        return;
      }

      const isLusdApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.lusdToken,
        BLUSD_LP_ZAP_ADDRESS
      );

      setIsLusdApprovedWithAmmZapper(isLusdApproved);
    })();
  }, [contracts.lusdToken, account, isLusdApprovedWithAmmZapper, BLUSD_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (contracts.bLusdAmm === undefined || isBLusdLpApprovedWithAmmZapper) return;
      const lpToken = await api.getLpToken(contracts.bLusdAmm);
      const isLpApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        lpToken,
        BLUSD_LP_ZAP_ADDRESS
      );

      setIsBLusdLpApprovedWithAmmZapper(isLpApproved);
    })();
  }, [contracts.bLusdAmm, account, isBLusdLpApprovedWithAmmZapper, BLUSD_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BLUSD_LP_ZAP_ADDRESS === null ||
        contracts.bLusdToken === undefined ||
        isBLusdApprovedWithAmmZapper
      ) {
        return;
      }

      const isBLusdApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.bLusdToken,
        BLUSD_LP_ZAP_ADDRESS
      );

      setIsLusdApprovedWithAmmZapper(isBLusdApproved);
    })();
  }, [contracts.bLusdToken, account, isBLusdApprovedWithAmmZapper, BLUSD_LP_ZAP_ADDRESS]);

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
          contracts.bLusdGauge === undefined ||
          !shouldSynchronize ||
          isSynchronizing
        ) {
          return;
        }
        setIsSynchronizing(true);

        const latest = await contracts.getLatestData(account, api);
        if (latest === undefined) {
          setIsSynchronizing(false);
          return;
        }

        const {
          protocolInfo,
          bonds,
          stats,
          bLusdBalance,
          lusdBalance,
          lpTokenBalance,
          stakedLpTokenBalance,
          lpTokenSupply,
          bLusdAmmBLusdBalance,
          bLusdAmmLusdBalance,
          lpRewards
        } = latest;

        setProtocolInfo(protocolInfo);

        // Don't change the simualted price if we already have one since only the user should change it
        if (simulatedProtocolInfo === undefined) {
          const simulatedProtocolInfo = _getProtocolInfo(
            protocolInfo.simulatedMarketPrice,
            protocolInfo.floorPrice,
            protocolInfo.claimBondFee,
            protocolInfo.alphaAccrualFactor
          );
          setSimulatedProtocolInfo({
            ...protocolInfo,
            ...simulatedProtocolInfo,
            simulatedMarketPrice: protocolInfo.simulatedMarketPrice
          });
        }

        setShouldSynchronize(false);
        setLpRewards(lpRewards);
        setBLusdBalance(bLusdBalance);
        setLusdBalance(lusdBalance);
        setLpTokenBalance(lpTokenBalance);
        setStakedLpTokenBalance(stakedLpTokenBalance);
        setLpTokenSupply(lpTokenSupply);
        setBLusdAmmBLusdBalance(bLusdAmmBLusdBalance);
        setBLusdAmmLusdBalance(bLusdAmmLusdBalance);
        setStats(stats);
        setBonds(bonds);
        setOptimisticBond(undefined);
      } catch (error: unknown) {
        console.error("Synchronising effect exception", error);
      }

      setIsSynchronizing(false);
    })();
  }, [isSynchronizing, shouldSynchronize, account, contracts, simulatedProtocolInfo]);

  const [approveInfiniteBond, approveStatus] = useTransaction(async () => {
    await api.approveInfiniteBond(
      contracts.lusdToken,
      contracts.chickenBondManager,
      liquity.connection.signer
    );
    setIsInfiniteBondApproved(true);
  }, [contracts.lusdToken, contracts.chickenBondManager, liquity.connection.signer]);

  const [approveAmm, approveAmmStatus] = useTransaction(
    async (tokensNeedingApproval: BLusdAmmTokenIndex[]) => {
      for (const token of tokensNeedingApproval) {
        if (token === BLusdAmmTokenIndex.BLUSD) {
          await (isMainnet
            ? api.approveTokenWithBLusdAmmMainnet(contracts.bLusdToken, liquity.connection.signer)
            : api.approveTokenWithBLusdAmm(
                contracts.bLusdToken,
                BLUSD_AMM_ADDRESS,
                liquity.connection.signer
              ));

          setIsBLusdApprovedWithBlusdAmm(true);
        } else {
          await (isMainnet
            ? api.approveTokenWithBLusdAmmMainnet(contracts.lusdToken, liquity.connection.signer)
            : api.approveTokenWithBLusdAmm(
                contracts.lusdToken,
                BLUSD_AMM_ADDRESS,
                liquity.connection.signer
              ));

          setIsLusdApprovedWithBlusdAmm(true);
        }
      }
    },
    [
      contracts.bLusdToken,
      contracts.lusdToken,
      isMainnet,
      BLUSD_AMM_ADDRESS,
      liquity.connection.signer
    ]
  );

  const [approveTokens, approveTokensStatus] = useTransaction(
    async ({ tokensNeedingApproval }: ApprovePressedPayload) => {
      if (contracts.bLusdAmm === undefined) return;
      for (const [token, spender] of Array.from(tokensNeedingApproval)) {
        if (token === BLusdAmmTokenIndex.BLUSD) {
          await api.approveToken(contracts.bLusdToken, spender, liquity.connection.signer);
          if (spender === BLUSD_AMM_ADDRESS) {
            setIsBLusdApprovedWithBlusdAmm(true);
          } else if (spender === BLUSD_LP_ZAP_ADDRESS) {
            setIsBLusdApprovedWithAmmZapper(true);
          }
        } else if (token === BLusdAmmTokenIndex.LUSD) {
          await api.approveToken(
            contracts.lusdToken,
            BLUSD_LP_ZAP_ADDRESS,
            liquity.connection.signer
          );
          setIsLusdApprovedWithAmmZapper(true);
        } else if (token === BLusdAmmTokenIndex.BLUSD_LUSD_LP && spender === undefined) {
          const lpToken = await api.getLpToken(contracts.bLusdAmm);
          await api.approveToken(lpToken, BLUSD_LP_ZAP_ADDRESS, liquity.connection.signer);
          setIsBLusdLpApprovedWithAmmZapper(true);
        } else if (token === BLusdAmmTokenIndex.BLUSD_LUSD_LP) {
          const lpToken = await api.getLpToken(contracts.bLusdAmm);
          await api.approveToken(lpToken, spender, liquity.connection.signer);
          if (spender === BLUSD_LP_ZAP_ADDRESS) {
            setIsBLusdLpApprovedWithAmmZapper(true);
          } else if (spender === BLUSD_AMM_STAKING_ADDRESS) {
            setIsBLusdLpApprovedWithGauge(true);
          }
        }
      }
    },
    [
      contracts.bLusdAmm,
      contracts.bLusdToken,
      contracts.lusdToken,
      BLUSD_LP_ZAP_ADDRESS,
      BLUSD_AMM_STAKING_ADDRESS,
      BLUSD_AMM_ADDRESS,
      liquity.connection.signer
    ]
  );

  const [createBond, createStatus] = useTransaction(
    async (lusdAmount: Decimal) => {
      await api.createBond(
        lusdAmount,
        account,
        contracts.chickenBondManager,
        liquity.connection.signer
      );
      const optimisticBond: OptimisticBond = {
        id: "OPTIMISTIC_BOND",
        deposit: lusdAmount,
        startTime: Date.now(),
        status: "PENDING"
      };
      setOptimisticBond(optimisticBond);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, liquity.connection.signer, account]
  );

  const [cancelBond, cancelStatus] = useTransaction(
    async (bondId: string, minimumLusd: Decimal) => {
      await api.cancelBond(
        bondId,
        minimumLusd,
        account,
        contracts.chickenBondManager,
        liquity.connection.signer
      );
      removeBondFromList(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, removeBondFromList, liquity.connection.signer, account]
  );

  const [claimBond, claimStatus] = useTransaction(
    async (bondId: string) => {
      await api.claimBond(bondId, account, contracts.chickenBondManager, liquity.connection.signer);
      changeBondStatusToClaimed(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, changeBondStatusToClaimed, liquity.connection.signer, account]
  );

  const getExpectedSwapOutput = useCallback(
    async (inputToken: BLusdAmmTokenIndex, inputAmount: Decimal) =>
      contracts.bLusdAmm
        ? (isMainnet ? api.getExpectedSwapOutputMainnet : api.getExpectedSwapOutput)(
            inputToken,
            inputAmount,
            contracts.bLusdAmm
          )
        : Decimal.ZERO,
    [contracts.bLusdAmm, isMainnet]
  );

  const [swapTokens, swapStatus] = useTransaction(
    async (inputToken: BLusdAmmTokenIndex, inputAmount: Decimal, minOutputAmount: Decimal) => {
      await (isMainnet ? api.swapTokensMainnet : api.swapTokens)(
        inputToken,
        inputAmount,
        minOutputAmount,
        contracts.bLusdAmm,
        liquity.connection.signer,
        account
      );
      setShouldSynchronize(true);
    },
    [contracts.bLusdAmm, isMainnet, liquity.connection.signer, account]
  );

  const getExpectedLpTokens = useCallback(
    async (bLusdAmount: Decimal, lusdAmount: Decimal) => {
      return contracts.bLusdAmmZapper
        ? api.getExpectedLpTokens(bLusdAmount, lusdAmount, contracts.bLusdAmmZapper)
        : Decimal.ZERO;
    },
    [contracts.bLusdAmmZapper]
  );

  const [manageLiquidity, manageLiquidityStatus] = useTransaction(
    async (params: ManageLiquidityPayload) => {
      if (params.action === "addLiquidity") {
        await api.addLiquidity(
          params.bLusdAmount,
          params.lusdAmount,
          params.minLpTokens,
          params.shouldStakeInGauge,
          contracts.bLusdAmmZapper,
          liquity.connection.signer,
          account
        );
      } else if (params.action === "removeLiquidity") {
        await api.removeLiquidity(
          params.burnLpTokens,
          params.minBLusdAmount,
          params.minLusdAmount,
          contracts.bLusdAmmZapper,
          liquity.connection.signer
        );
      } else if (params.action === "removeLiquidityOneCoin") {
        await api.removeLiquidityOneCoin(
          params.burnLpTokens,
          params.output,
          params.minAmount,
          contracts.bLusdAmmZapper,
          contracts.bLusdAmm,
          liquity.connection.signer,
          account
        );
      } else if (params.action === "stakeLiquidity") {
        await api.stakeLiquidity(
          params.stakeAmount,
          contracts.bLusdGauge,
          liquity.connection.signer
        );
      } else if (params.action === "unstakeLiquidity") {
        await api.unstakeLiquidity(
          params.unstakeAmount,
          contracts.bLusdGauge,
          liquity.connection.signer
        );
      } else if (params.action === "claimLpRewards") {
        await api.claimLpRewards(contracts.bLusdGauge, liquity.connection.signer);
      }
      setShouldSynchronize(true);
    },
    [
      contracts.bLusdAmmZapper,
      contracts.bLusdGauge,
      contracts.bLusdAmm,
      liquity.connection.signer,
      account
    ]
  );

  const getExpectedWithdrawal = useCallback(
    async (
      burnLp: Decimal,
      output: BLusdAmmTokenIndex | "both"
    ): Promise<Map<BLusdAmmTokenIndex, Decimal>> => {
      if (contracts.bLusdAmm === undefined)
        return new Map([
          [BLusdAmmTokenIndex.LUSD, Decimal.ZERO],
          [BLusdAmmTokenIndex.BLUSD, Decimal.ZERO]
        ]);

      return contracts.bLusdAmmZapper
        ? api.getExpectedWithdrawal(burnLp, output, contracts.bLusdAmmZapper, contracts.bLusdAmm)
        : new Map();
    },
    [contracts.bLusdAmmZapper, contracts.bLusdAmm]
  );

  const selectedBond = useMemo(() => bonds?.find(bond => bond.id === selectedBondId), [
    bonds,
    selectedBondId
  ]);

  const dispatchEvent = useCallback(
    async (event: BondEvent, payload?: Payload) => {
      if (!isValidEvent(viewRef.current, event)) {
        console.error("invalid event", event, payload, "in view", viewRef.current);
        return;
      }

      const nextView = transition(viewRef.current, event);
      setView(nextView);

      if (payload && "bondId" in payload && payload.bondId !== selectedBondId) {
        setSelectedBondId(payload.bondId);
      }

      if (payload && "inputToken" in payload && payload.inputToken !== inputToken) {
        setInputToken(payload.inputToken);
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
        } else if (isCurrentViewEvent("SWAPPING", "APPROVE_PRESSED")) {
          await approveAmm([inputToken]);
        } else if (isCurrentViewEvent("SWAPPING", "CONFIRM_PRESSED")) {
          const { inputAmount, minOutputAmount } = payload as SwapPayload;
          await swapTokens(inputToken, inputAmount, minOutputAmount);
          await dispatchEvent("SWAP_CONFIRMED");
        } else if (isCurrentViewEvent("MANAGING_LIQUIDITY", "APPROVE_PRESSED")) {
          await approveTokens(payload as ApprovePressedPayload);
        } else if (isCurrentViewEvent("MANAGING_LIQUIDITY", "CONFIRM_PRESSED")) {
          await manageLiquidity(payload as ManageLiquidityPayload);
          await dispatchEvent("MANAGE_LIQUIDITY_CONFIRMED");
        }
      } catch (error: unknown) {
        console.error("dispatchEvent(), event handler failed\n\n", error);
      }
    },
    [
      selectedBondId,
      approveInfiniteBond,
      cancelBond,
      createBond,
      claimBond,
      selectedBond,
      approveAmm,
      approveTokens,
      swapTokens,
      inputToken,
      manageLiquidity
    ]
  );

  useEffect(() => {
    setStatuses(statuses => ({
      ...statuses,
      APPROVE: approveStatus,
      CREATE: createStatus,
      CANCEL: cancelStatus,
      CLAIM: claimStatus,
      APPROVE_AMM: approveAmmStatus,
      APPROVE_SPENDER: approveTokensStatus,
      SWAP: swapStatus,
      MANAGE_LIQUIDITY: manageLiquidityStatus
    }));
  }, [
    approveStatus,
    createStatus,
    cancelStatus,
    claimStatus,
    approveAmmStatus,
    approveTokensStatus,
    swapStatus,
    manageLiquidityStatus
  ]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    (async () => {
      if (
        bonds === undefined ||
        protocolInfo === undefined ||
        contracts.chickenBondManager === undefined
      )
        return;

      if (protocolInfo.bLusdSupply.gt(0)) {
        setIsBootstrapPeriodActive(false);
        return;
      }

      const bootstrapPeriodMs =
        (await contracts.chickenBondManager.BOOTSTRAP_PERIOD_CHICKEN_IN()).toNumber() * 1000;

      const anyBondOlderThanBootstrapPeriod =
        bonds.find(bond => Date.now() - bond.startTime > bootstrapPeriodMs) !== undefined;

      setIsBootstrapPeriodActive(!anyBondOlderThanBootstrapPeriod);
    })();
  }, [bonds, protocolInfo, contracts.chickenBondManager]);

  const provider: BondViewContextType = {
    view,
    dispatchEvent,
    selectedBondId,
    optimisticBond,
    protocolInfo,
    stats,
    bonds,
    statuses,
    selectedBond,
    bLusdBalance,
    lusdBalance,
    lpTokenBalance,
    stakedLpTokenBalance,
    lpTokenSupply,
    bLusdAmmBLusdBalance,
    bLusdAmmLusdBalance,
    isInfiniteBondApproved,
    isSynchronizing,
    getLusdFromFaucet,
    setSimulatedMarketPrice,
    resetSimulatedMarketPrice,
    simulatedProtocolInfo,
    hasFoundContracts: contracts.hasFoundContracts,
    isBLusdApprovedWithBlusdAmm,
    isLusdApprovedWithBlusdAmm,
    isLusdApprovedWithAmmZapper,
    isBLusdApprovedWithAmmZapper,
    isBLusdLpApprovedWithAmmZapper,
    isBLusdLpApprovedWithGauge,
    inputToken,
    isInputTokenApprovedWithBLusdAmm:
      inputToken === BLusdAmmTokenIndex.BLUSD
        ? isBLusdApprovedWithBlusdAmm
        : isLusdApprovedWithBlusdAmm,
    getExpectedSwapOutput,
    getExpectedLpTokens,
    getExpectedWithdrawal,
    isBootstrapPeriodActive,
    hasLoaded: protocolInfo !== undefined && bonds !== undefined,
    addresses: contracts.addresses,
    lpRewards
  };

  // window.__LIQUITY_BONDS__ = provider.current;

  return <BondViewContext.Provider value={provider}>{children}</BondViewContext.Provider>;
};
