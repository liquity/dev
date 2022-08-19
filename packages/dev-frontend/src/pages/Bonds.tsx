import { Container } from "theme-ui";
import { BondStats } from "../components/BondStats";
import { Bonds as BondPanel } from "../components/Bonds/Bonds";
import { useBondView } from "../components/Bonds/context/BondViewContext";
import type {
  BondTransaction,
  TransactionStatus as TransactionStatusType
} from "../components/Bonds/context/transitions";
import { TransactionStatus } from "../components/TransactionStatus";
import type { TransactionStateType } from "../components/TransactionStatus";

type BondTransactionStatusToTransactionStateMap = Record<
  TransactionStatusType,
  TransactionStateType
>;
const statusMap: BondTransactionStatusToTransactionStateMap = {
  IDLE: "idle",
  PENDING: "waitingForConfirmation",
  FAILED: "failed",
  CONFIRMED: "confirmed"
};

export const Bonds: React.FC = () => {
  const { statuses } = useBondView();
  const transaction = (Object.keys(statuses) as BondTransaction[]).find(
    status => statuses[status] !== "IDLE"
  );
  const status = transaction ? statusMap[statuses[transaction]] : null;

  return (
    <>
      <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
        <Container variant="left" sx={{ width: ["100%", "70%"] }}>
          <BondPanel />
        </Container>

        <Container variant="right" sx={{ width: ["100%", "30%"] }}>
          <BondStats />
        </Container>
      </Container>
      {status && <TransactionStatus state={status} style={{ zIndex: 9999999999 }} />}
    </>
  );
};
