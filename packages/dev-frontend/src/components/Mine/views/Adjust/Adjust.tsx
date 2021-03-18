import React, { useCallback, useEffect, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, Decimalish, Difference } from "@liquity/lib-base";
// import { Decimal, Decimalish, Difference, MiningDeposit } from "@liquity/lib-base";
import { LP, GT } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMineView } from "../../context/MineViewContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { ConfirmButton } from "./ConfirmButton";
import { AdjustActionDescription } from "./ActionDescription";

export const Adjust: React.FC = () => {
  const { dispatchEvent } = useMineView();
  // const { lpBalance, lpStaked } = useLiquitySelector(selector);

  const lpBalance = Decimal.from(100);
  const lpStaked = Decimal.from(10);
  const lpReward = Decimal.from(50);
  const [amount, setAmount] = useState<string>(lpStaked.prettify());

  const isDirty = amount !== lpStaked.prettify();
  const editingState = useState<string>();

  const transactionId = "mine-adjust";
  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const [shouldClaimRewards, setShouldClaimRewards] = useState(false);
  const toggleClaimRewards = useCallback(() => {
    setShouldClaimRewards(!shouldClaimRewards);
  }, [shouldClaimRewards, setShouldClaimRewards]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("ADJUST_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Card>
      <Heading>
        Liquidity mine
        {isDirty && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(lpStaked.prettify())}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {isTransactionPending && <LoadingOverlay />}

      <Box>
        <EditableRow
          label="Deposit"
          inputId="mine-amount-lp"
          amount={lpStaked.prettify() || "0"}
          unit={LP}
          editingState={editingState}
          editedAmount={amount || "0"}
          setEditedAmount={amount => setAmount(amount)}
        ></EditableRow>

        <StaticRow
          label="Reward"
          inputId="mine-lp-reward"
          amount={lpReward.prettify(4)}
          color={lpReward.nonZero && "success"}
          unit={GT}
        />

        <Flex sx={{ m: 2, justifyContent: "flex-end", alignItems: "center" }}>
          <input type="checkbox" id="claimRewards" onChange={toggleClaimRewards} />
          <label htmlFor="claimRewards">Claim rewards</label>
        </Flex>

        <AdjustActionDescription amount={amount} shouldClaimRewards={shouldClaimRewards} />

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <ConfirmButton amount={amount || "0"} />
        </Flex>
      </Box>
    </Card>
  );
};
