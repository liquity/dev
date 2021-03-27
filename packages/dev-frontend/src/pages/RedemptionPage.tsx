import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Redemption } from "../components/Redemption/Redemption";

export const RedemptionPage: React.FC = () => (
  <Container variant="columns">
    <Container variant="left">
      <Redemption />
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
