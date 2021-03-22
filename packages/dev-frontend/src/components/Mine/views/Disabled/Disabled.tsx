import React from "react";
import { Card, Heading, Box, Flex } from "theme-ui";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoMessage } from "../../../InfoMessage";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { RemainingLQTY } from "../RemainingLQTY";

const selector = ({ liquidityMiningStake }: LiquityStoreState) => ({ liquidityMiningStake });

export const Disabled: React.FC = () => {
  const { liquidityMiningStake } = useLiquitySelector(selector);
  const hasStake = !liquidityMiningStake.isZero;

  return (
    <Card>
      <Heading>
        Liquidity mine
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Liquidity mining period has finished">
          <Flex>There are no more LQTY rewards left to mine</Flex>
        </InfoMessage>

        {hasStake && (
          <Flex variant="layout.actions">
            <UnstakeAndClaim />
          </Flex>
        )}
      </Box>
    </Card>
  );
};
