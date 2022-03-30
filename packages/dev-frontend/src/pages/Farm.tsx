import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Farm as FarmPanel } from "../components/Farm/Farm";
import { Staking } from "../components/Staking/Staking"; 
import { TopSystemStats } from "../components/TopSystemStats";
import { Stability } from "../components/Stability/Stability";

const statsToShow: string[] = ["tvl", "lusd-supply", "lusd-sp", "staked-lqty", "tcr"]

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="single">
      <TopSystemStats filterStats={["lusd-sp", "staked-lqty"]}/>
      <Stability />
      <Staking />
      <FarmPanel />
      <SystemStats showProtocol filterStats={statsToShow}/>
    </Container>
  </Container>
);
