import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { Staking } from "../components/Staking/Staking";

export const Dashboard: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <Trove />
      <Stability />
      <Staking />
    </Container>

    <Container variant="right">
      <SystemStats />
      <PriceManager />
    </Container>
  </Container>
);
