import React from "react";
import { Container, Card, Box, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskiestTroves } from "../components/RiskiestTroves";
import { InfoMessage } from "../components/InfoMessage";

export const Liquidation: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <Card>
        <Box sx={{ p: [2, 3] }}>
          <InfoMessage title="Bot functionality">
            <Paragraph>This functionality is expected to be carried out by bots.</Paragraph>
            <Paragraph>
              Early on you may be able to manually liquidate Troves, but as the system matures this
              will become less likely.
            </Paragraph>
          </InfoMessage>
        </Box>
      </Card>
      <LiquidationManager />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
    <RiskiestTroves pageSize={10} />
  </Container>
);
