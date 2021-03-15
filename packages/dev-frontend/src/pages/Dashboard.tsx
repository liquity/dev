import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { StakingManager } from "../components/StakingManager";
import { RedemptionManager } from "../components/RedemptionManager";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskiestTroves } from "../components/RiskiestTroves";
import { TroveViewProvider } from "../components/Trove/context/TroveViewProvider";
import { StabilityViewProvider } from "../components/Stability/context/StabilityViewProvider";

export const Dashboard: React.FC = () => (
  <>
    <Container variant="columns">
      <Container variant="left">
        <TroveViewProvider>
          <Trove />
        </TroveViewProvider>
        <StabilityViewProvider>
          <Stability />
        </StabilityViewProvider>
        <StakingManager />
        <RedemptionManager />
      </Container>

      <Container variant="right">
        <SystemStats />
        <PriceManager />
        <LiquidationManager />
      </Container>
    </Container>

    <RiskiestTroves pageSize={10} />
  </>
);
