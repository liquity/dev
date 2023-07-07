import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Trove/Editor";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingSTBL } from "../RemainingSTBL";
import { ClaimReward } from "./ClaimReward";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { Yield } from "../Yield";

const selector = ({
  liquidityMiningStake,
  liquidityMiningSTBLReward,
  totalStakedUniTokens
}: LiquityStoreState) => ({
  liquidityMiningStake,
  liquidityMiningSTBLReward,
  totalStakedUniTokens
});
const transactionId = /farm-/i;

export const Active: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const {
    liquidityMiningStake,
    liquidityMiningSTBLReward,
    totalStakedUniTokens
  } = useLiquitySelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const poolShare = liquidityMiningStake.mulDiv(100, totalStakedUniTokens);
  const hasStakeAndRewards = !liquidityMiningStake.isZero && !liquidityMiningSTBLReward.isZero;

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        {!isTransactionPending && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingSTBL />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Stake"
            inputId="farm-stake"
            amount={liquidityMiningStake.prettify(4)}
            unit={LP}
          />
          {poolShare.infinite ? (
            <StaticRow label="Pool share" inputId="farm-share" amount="N/A" />
          ) : (
            <StaticRow
              label="Pool share"
              inputId="farm-share"
              amount={poolShare.prettify(4)}
              unit={"%"}
            />
          )}
          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="farm-reward"
              amount={liquidityMiningSTBLReward.prettify(4)}
              color={liquidityMiningSTBLReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant={!liquidityMiningSTBLReward.isZero ? "outline" : "primary"}
            onClick={handleAdjustPressed}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          {!liquidityMiningSTBLReward.isZero && <ClaimReward />}
        </Flex>
        <Flex>{hasStakeAndRewards && <UnstakeAndClaim />}</Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
