import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { Farm as FarmPanel } from "../components/Farm/Farm";
import { Staking } from "../components/Staking/Staking"; 
import { Stability } from "../components/Stability/Stability";

const statsToShow: string[] = ["tvl", "lusd-supply", "lusd-sp", "staked-lqty", "tcr"]

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <Staking />
      <Stability />
      <FarmPanel />
    </Container>

    <Container variant="right">
      <SystemStats showProtocol filterStats={statsToShow}/>
    </Container>
  </Container>
);
