import React, { useCallback, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { LP } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMineView } from "../../context/MineViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { Confirm } from "./Confirm";
import { Description } from "./Description";
import { Approve } from "./Approve";

const transactionId = "mine-stake";
const selector = ({ uniTokenAllowance, uniTokenBalance }: LiquityStoreState) => ({
  uniTokenAllowance,
  uniTokenBalance
});

export const Staking: React.FC = () => {
  const { dispatchEvent } = useMineView();
  const [amount, setAmount] = useState<Decimal>(Decimal.from(0));
  const editingState = useState<string>();
  const isDirty = !amount.isZero;

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const { uniTokenAllowance, uniTokenBalance } = useLiquitySelector(selector);
  const hasEnoughUniTokens = uniTokenBalance.gte(amount);
  const hasApprovedEnoughUniTokens = !uniTokenAllowance.isZero && uniTokenAllowance.gte(amount);
  const canStake = hasEnoughUniTokens && hasApprovedEnoughUniTokens;
  console.log({ uniTokenAllowance: uniTokenAllowance.prettify() });
  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Liquidity mine
        {isDirty && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(Decimal.from(0))}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {isTransactionPending && <LoadingOverlay />}

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="amount-lp"
          amount={amount.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.prettify(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
        ></EditableRow>

        {isDirty && <Description amount={amount} uniTokenBalance={uniTokenBalance} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <Approve isDisabled={hasApprovedEnoughUniTokens} amount={amount} />
          <Confirm isDisabled={!canStake} amount={amount} />
        </Flex>
      </Box>
    </Card>
  );
};
