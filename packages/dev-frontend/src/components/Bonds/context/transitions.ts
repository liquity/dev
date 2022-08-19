import { Decimal } from "@liquity/lib-base";

type Idle = "IDLE";
type Creating = "CREATING";
type Cancelling = "CANCELLING";
type Claiming = "CLAIMING";

export type BondView = Idle | Creating | Cancelling | Claiming;

/* UI events */
type CreateBondPressed = "CREATE_BOND_PRESSED";
type CancelPressed = "ABORT_PRESSED";
type BackPressed = "BACK_PRESSED";
type ApprovePressed = "APPROVE_PRESSED";
type ConfirmPressed = "CONFIRM_PRESSED";
type CancelBondPressed = "CANCEL_BOND_PRESSED";
type ClaimBondPressed = "CLAIM_BOND_PRESSED";

/* On-chain events */
type CreateBondConfirmed = "CREATE_BOND_CONFIRMED";
type CancelBondConfirmed = "CANCEL_BOND_CONFIRMED";
type ClaimBondConfirmed = "CLAIM_BOND_CONFIRMED";

export type BondEvent =
  | CreateBondPressed
  | CancelBondPressed
  | ClaimBondPressed
  | ApprovePressed
  | ConfirmPressed
  | CancelPressed
  | BackPressed
  | CreateBondConfirmed
  | CancelBondConfirmed
  | ClaimBondConfirmed;

type BondEventTransitions = Record<BondView, Partial<Record<BondEvent, BondView>>>;

export const transitions: BondEventTransitions = {
  IDLE: {
    CREATE_BOND_PRESSED: "CREATING",
    CANCEL_BOND_PRESSED: "CANCELLING",
    CLAIM_BOND_PRESSED: "CLAIMING"
  },
  CREATING: {
    ABORT_PRESSED: "IDLE",
    CREATE_BOND_CONFIRMED: "IDLE",
    BACK_PRESSED: "IDLE",
    APPROVE_PRESSED: "CREATING",
    CONFIRM_PRESSED: "CREATING"
  },
  CLAIMING: {
    ABORT_PRESSED: "IDLE",
    BACK_PRESSED: "IDLE",
    CONFIRM_PRESSED: "CLAIMING",
    CLAIM_BOND_CONFIRMED: "IDLE"
  },
  CANCELLING: {
    ABORT_PRESSED: "IDLE",
    BACK_PRESSED: "IDLE",
    CONFIRM_PRESSED: "CANCELLING",
    CANCEL_BOND_CONFIRMED: "IDLE"
  }
};

export type CreateBondPayload = { deposit: Decimal };

export type SelectBondPayload = { bondId: string };

export type Payload = CreateBondPayload | SelectBondPayload;

export type BondStatus = "NON_EXISTENT" | "PENDING" | "CANCELLED" | "CLAIMED";

export type Bond = {
  id: string;
  deposit: Decimal;
  startTime: number;
  endTime: number;
  status: BondStatus;
  tokenUri: string;
  accrued: Decimal;
  breakEvenAccrual: Decimal;
  rebondAccrual: Decimal;
  breakEvenTime: number;
  rebondTime: number;
  marketValue: Decimal;
  rebondReturn: string;
  rebondRoi: Decimal;
  claimNowReturn: string;
};

export type Treasury = {
  pending: Decimal;
  reserve: Decimal;
  permanent: Decimal;
  total: Decimal;
};

export type Stats = {
  pendingBonds: Decimal;
  cancelledBonds: Decimal;
  claimedBonds: Decimal;
  totalBonds: Decimal;
};

export type ProtocolInfo = {
  bLusdSupply: Decimal;
  marketPrice: Decimal;
  fairPrice: Decimal;
  floorPrice: Decimal;
  claimBondFee: Decimal;
  alphaAccrualFactor: Decimal;
  marketPricePremium: Decimal;
  breakEvenTime: number;
  rebondTime: number;
  hasMarketPremium: boolean;
  simulatedMarketPrice: Decimal;
  breakEvenAccrualFactor: Decimal;
  rebondAccrualFactor: Decimal;
  breakEvenDays?: Decimal;
  rebondDays?: Decimal;
};

export type TransactionStatus = "IDLE" | "PENDING" | "CONFIRMED" | "FAILED";
export type BondTransaction = "APPROVE" | "CREATE" | "CANCEL" | "CLAIM";

export type BondTransactionStatuses = Record<BondTransaction, TransactionStatus>;
