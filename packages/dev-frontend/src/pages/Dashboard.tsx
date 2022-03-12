import { Container } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { Redemption } from "../components/Redemption/Redemption";

export const Dashboard: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <Trove />
      <Redemption />
    </Container>

    <Container variant="right">
      <SystemStats showProtocol showPriceFeed/>
      <PriceManager />
    </Container>
  </Container>
);
