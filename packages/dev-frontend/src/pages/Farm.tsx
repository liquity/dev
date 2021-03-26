import { Container } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { MineViewProvider } from "../components/Mine/context/MineViewProvider";
import { Mine } from "../components/Mine/Mine";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <MineViewProvider>
        <Mine />
      </MineViewProvider>
    </Container>

    <Container variant="right">
      <SystemStats />
    </Container>
  </Container>
);
