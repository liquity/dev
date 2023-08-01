import React from "react";
import { Card, Heading, Box, Flex } from "theme-ui";
import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
import { InfoMessage } from "../../../InfoMessage";
import { XbrlStblUnstakeAndClaim } from "../XbrlStblUnstakeAndClaim";
import { XbrlStblRemainingSTBL } from "../XbrlStblRemainingSTBL";
import { StaticRow } from "../../../Trove/Editor";
import { GT, LP } from "../../../../strings";

const selector = ({ xbrlStblLiquidityMiningStake, xbrlStblLiquidityMiningSTBLReward }: StabilioStoreState) => ({
  xbrlStblLiquidityMiningStake,
  xbrlStblLiquidityMiningSTBLReward
});

export const XbrlStblDisabled: React.FC = () => {
  const { xbrlStblLiquidityMiningStake, xbrlStblLiquidityMiningSTBLReward } = useStabilioSelector(selector);
  const hasStake = !xbrlStblLiquidityMiningStake.isZero;

  return (
    <Card>
      <Flex sx={{ justifyContent: "space-between", width: "100%", px: [2, 3], pt: 3, pb: 2 }}>
        <Heading sx={{ fontSize: 16  }}>
          STBL/xBRL Uniswap LP
        </Heading>
        <Flex sx={{ justifyContent: "flex-end" }}>
          <XbrlStblRemainingSTBL />
        </Flex>
      </Flex>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Liquidity farming period has finished">
          <Flex>There are no more STBL rewards left to farm</Flex>
        </InfoMessage>
        {hasStake && (
          <>
            <Box sx={{ border: 1, pt: 3, borderRadius: 3 }}>
              <StaticRow
                label="Stake"
                inputId="farm-deposit"
                amount={xbrlStblLiquidityMiningStake.prettify(4)}
                unit={LP}
              />
              <StaticRow
                label="Reward"
                inputId="farm-reward"
                amount={xbrlStblLiquidityMiningSTBLReward.prettify(4)}
                color={xbrlStblLiquidityMiningSTBLReward.nonZero && "success"}
                unit={GT}
              />
            </Box>
            <XbrlStblUnstakeAndClaim />
          </>
        )}
      </Box>
    </Card>
  );
};
