import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { SystemStats } from "../components/SystemStats";
import { Redemption } from "../components/Redemption/Redemption";

export const Dashboard: React.FC = () => (
  <Container variant="columns">
    <Container variant="single">
      <Trove />
      <Redemption />
      <SystemStats showProtocol showPriceFeed/>
    </Container>
  </Container>
);
