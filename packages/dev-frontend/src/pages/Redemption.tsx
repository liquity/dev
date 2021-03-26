import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { RedemptionManager } from "../components/Redemption/RedemptionManager";

export const Redemption: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <RedemptionManager />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
