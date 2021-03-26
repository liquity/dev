import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { MineViewProvider } from "../components/Farm/context/FarmViewProvider";
import { Farm as FarmPanel } from "../components/Farm/Farm";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <MineViewProvider>
        <FarmPanel />
      </MineViewProvider>
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
