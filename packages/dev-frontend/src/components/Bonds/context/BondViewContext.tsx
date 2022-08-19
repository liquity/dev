import { createContext, useContext } from "react";
import type {
  BondView,
  BondEvent,
  Payload,
  Treasury,
  Bond,
  Stats,
  BondTransactionStatuses,
  ProtocolInfo
} from "./transitions";
import { PENDING_STATUS, CANCELLED_STATUS, CLAIMED_STATUS } from "../lexicon";
import { Decimal } from "@liquity/lib-base";

export type BondViewContextType = {
  view: BondView;
  dispatchEvent: (event: BondEvent, payload?: Payload) => void;
  selectedBondId?: string;
  protocolInfo?: ProtocolInfo;
  stats?: Stats;
  treasury?: Treasury;
  bonds?: Bond[];
  createBond: (lusdAmount: Decimal) => Promise<void>;
  cancelBond: (bondId: string, minimumLusd: Decimal) => Promise<void>;
  claimBond: (bondId: string) => Promise<void>;
  selectedBond?: Bond;
  optimisticBond?: Bond;
  bLusdBalance?: Decimal;
  lusdBalance?: Decimal;
  statuses: BondTransactionStatuses;
  isInfiniteBondApproved: boolean;
  isSynchronising: boolean;
  getLusdFromFaucet: () => Promise<void>;
};

export const BondViewContext = createContext<BondViewContextType | null>(null);

export const useBondView = (): BondViewContextType => {
  const context: BondViewContextType | null = useContext(BondViewContext);

  if (context === null) {
    throw new Error("You must add a <BondViewProvider> into the React tree");
  }

  return context;
};

export const statuses = {
  PENDING: PENDING_STATUS.term,
  CANCELLED: CANCELLED_STATUS.term,
  CLAIMED: CLAIMED_STATUS.term,
  NON_EXISTENT: "NON_EXISTENT"
};
