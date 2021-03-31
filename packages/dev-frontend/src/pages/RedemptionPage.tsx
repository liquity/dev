import React from "react";
import { Box, Card, Container, Link, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Redemption } from "../components/Redemption/Redemption";
import { InfoMessage } from "../components/InfoMessage";
import { useLiquity } from "../hooks/LiquityContext";
import { Icon } from "../components/Icon";

const uniLink = (lusdAddress: string) =>
  `https://app.uniswap.org/#/swap?inputCurrency=${lusdAddress}&outputCurrency=ETH`;

export const RedemptionPage: React.FC = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();

  return (
    <Container variant="columns">
      <Container variant="left">
        <Card>
          <Box sx={{ p: [2, 3] }}>
            <InfoMessage title="Bot functionality">
              <Paragraph>
                This functionality is expected to be carried out by bots when arbitrage opportunities
                emerge.
              </Paragraph>
              <Paragraph>
                You will probably be able to get a better rate for converting LUSD to ETH on{" "}
                <Link href={uniLink(addresses["lusdToken"])} target="_blank">
                  Uniswap <Icon name="external-link-alt" size="xs" />
                </Link>
              </Paragraph>
            </InfoMessage>
          </Box>
        </Card>
        <Redemption />
      </Container>

      <Container variant="right">
        <SystemStats />
      </Container>
    </Container>
  );
};
