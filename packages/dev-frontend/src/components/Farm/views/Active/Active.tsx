import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
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
  xbrlWethLiquidityMiningStake,
  xbrlWethLiquidityMiningSTBLReward,
  totalStakedXbrlWethUniTokens
}: StabilioStoreState) => ({
  xbrlWethLiquidityMiningStake,
  xbrlWethLiquidityMiningSTBLReward,
  totalStakedXbrlWethUniTokens
});
const transactionId = /farm-/i;

export const Active: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const {
    xbrlWethLiquidityMiningStake,
    xbrlWethLiquidityMiningSTBLReward,
    totalStakedXbrlWethUniTokens
  } = useStabilioSelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const poolShare = xbrlWethLiquidityMiningStake.mulDiv(100, totalStakedXbrlWethUniTokens);
  const hasStakeAndRewards = !xbrlWethLiquidityMiningStake.isZero && !xbrlWethLiquidityMiningSTBLReward.isZero;

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
            amount={xbrlWethLiquidityMiningStake.prettify(4)}
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
              amount={xbrlWethLiquidityMiningSTBLReward.prettify(4)}
              color={xbrlWethLiquidityMiningSTBLReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant={!xbrlWethLiquidityMiningSTBLReward.isZero ? "outline" : "primary"}
            onClick={handleAdjustPressed}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          {!xbrlWethLiquidityMiningSTBLReward.isZero && <ClaimReward />}
        </Flex>
        <Flex>{hasStakeAndRewards && <UnstakeAndClaim />}</Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
