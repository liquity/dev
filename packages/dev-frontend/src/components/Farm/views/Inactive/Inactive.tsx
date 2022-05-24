import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button, Link, Paragraph } from "theme-ui";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Icon } from "../../../Icon";
import { InfoMessage } from "../../../InfoMessage";
import { useFarmView } from "../../context/FarmViewContext";
import { RemainingLQTY } from "../RemainingLQTY";
import { Yield } from "../Yield";

const uniLink = (lusdAddress: string) => `https://app.uniswap.org/#/add/ETH/${lusdAddress}`;

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
        Uniswap Opal Farm
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You aren't farming OPAL.">
          <Paragraph>You can farm OPAL by staking your Uniswap AUT/OUSD LP tokens.</Paragraph>

          <Paragraph sx={{ mt: 2 }}>
            You can obtain LP tokens by adding liquidity to the{" "}
            <Link href={uniLink(addresses["lusdToken"])} target="_blank">
              AUT/OUSD pool on Uniswap. <Icon name="external-link-alt" size="xs" />
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
