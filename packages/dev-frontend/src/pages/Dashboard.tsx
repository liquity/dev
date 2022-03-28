import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { SystemStats } from "../components/SystemStats";
import { TopSystemStats } from "../components/TopSystemStats";
import { Redemption } from "../components/Redemption/Redemption";

export const Dashboard: React.FC = () => (
  <Container variant="columns">
    <Container variant="single">
      <TopSystemStats showProtocol showBalances showPriceFeed filterStats={['aut']}/>
      <Trove />
      <Redemption />
      <SystemStats showProtocol showPriceFeed/>
    </Container>
  </Container>
);
