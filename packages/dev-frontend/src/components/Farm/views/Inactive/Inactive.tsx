import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button, Link, Paragraph } from "theme-ui";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Icon } from "../../../Icon";
import { InfoMessage } from "../../../InfoMessage";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingSTBL } from "../RemainingSTBL";
import { Yield } from "../Yield";

const uniLink = (xbrlAddress: string) => `https://app.uniswap.org/#/add/ETH/${xbrlAddress}`;

export const Inactive: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();

  const handleStakePressed = useCallback(() => {
    dispatchEvent("STAKE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingSTBL />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You aren't farming STBL.">
          <Paragraph>You can farm STBL by staking your Uniswap ETH/XBRL LP tokens.</Paragraph>

          <Paragraph sx={{ mt: 2 }}>
            You can obtain LP tokens by adding liquidity to the{" "}
            <Link href={uniLink(addresses["xbrlToken"])} target="_blank">
              ETH/XBRL pool on Uniswap. <Icon name="external-link-alt" size="xs" />
            </Link>
          </Paragraph>
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", alignItems: "center", flex: 1 }}>
            <Yield />
          </Flex>
          <Button onClick={handleStakePressed}>Stake</Button>
        </Flex>
      </Box>
    </Card>
  );
};
