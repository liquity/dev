import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Trove/Editor";
import { useXbrlStblFarmView } from "../../context/XbrlStblFarmViewContext";
import { XbrlStblRemainingSTBL } from "../XbrlStblRemainingSTBL";
import { ClaimXbrlStblReward } from "./ClaimXbrlStblReward";
import { XbrlStblUnstakeAndClaim } from "../XbrlStblUnstakeAndClaim";
import { XbrlStblYield } from "../XbrlStblYield";

const selector = ({
  xbrlStblLiquidityMiningStake,
  xbrlStblLiquidityMiningSTBLReward,
  totalStakedXbrlStblUniTokens
}: StabilioStoreState) => ({
  xbrlStblLiquidityMiningStake,
  xbrlStblLiquidityMiningSTBLReward,
  totalStakedXbrlStblUniTokens
});
const transactionId = /farm-/i;

export const XbrlStblActive: React.FC = () => {
  const { dispatchEvent } = useXbrlStblFarmView();
  const {
    xbrlStblLiquidityMiningStake,
    xbrlStblLiquidityMiningSTBLReward,
    totalStakedXbrlStblUniTokens
  } = useStabilioSelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const poolShare = xbrlStblLiquidityMiningStake.mulDiv(100, totalStakedXbrlStblUniTokens);
  const hasStakeAndRewards = !xbrlStblLiquidityMiningStake.isZero && !xbrlStblLiquidityMiningSTBLReward.isZero;

  return (
    <Card>
      <Flex sx={{ justifyContent: "space-between", width: "100%", px: [2, 3], pt: 3, pb: 2 }}>
        <Heading sx={{ fontSize: 16  }}>
          STBL/xBRL Uniswap LP
        </Heading>
        {!isTransactionPending && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <XbrlStblRemainingSTBL />
          </Flex>
        )}
      </Flex>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Stake"
            inputId="farm-stake"
            amount={xbrlStblLiquidityMiningStake.prettify(4)}
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
              amount={xbrlStblLiquidityMiningSTBLReward.prettify(4)}
              color={xbrlStblLiquidityMiningSTBLReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <XbrlStblYield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button
            variant={!xbrlStblLiquidityMiningSTBLReward.isZero ? "outline" : "primary"}
            onClick={handleAdjustPressed}
          >
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          {!xbrlStblLiquidityMiningSTBLReward.isZero && <ClaimXbrlStblReward />}
        </Flex>
        <Flex>{hasStakeAndRewards && <XbrlStblUnstakeAndClaim />}</Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
