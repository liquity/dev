import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { StabilityDepositManager } from "../components/StabilityDepositManager";
import { StakingManager } from "../components/StakingManager";
import { RedemptionManager } from "../components/RedemptionManager";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskiestTroves } from "../components/RiskiestTroves";
import { TroveViewProvider } from "../components/Trove/context/TroveViewProvider";

export const Dashboard: React.FC = () => (
  <>
    <Container variant="columns">
      <Container variant="left">
        <TroveViewProvider>
          <Trove />
        </TroveViewProvider>
        {/* <TroveManager /> */}
        <StabilityDepositManager />
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
