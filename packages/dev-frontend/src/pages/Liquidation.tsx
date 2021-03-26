import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskiestTroves } from "../components/RiskiestTroves";

export const Liquidation: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <LiquidationManager />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
    <RiskiestTroves pageSize={10} />
  </Container>
);
