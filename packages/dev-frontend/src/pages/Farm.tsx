import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Farm as FarmPanel } from "../components/Farm/Farm";

const statsToShow: string[] = ["tvl", "lusd-supply", "lusd-sp", "staked-lqty", "tcr"]

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <FarmPanel />
    </Container>

    <Container variant="right">
      <SystemStats showBalances showProtocol filterStats={statsToShow}/>
    </Container>
  </Container>
);
