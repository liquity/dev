import { Container } from "theme-ui";
import { Farm as FarmPanel } from "../components/Farm/Farm";

export const Farm: React.FC = () => (
  <Container variant="columns" sx={{ justifyContent: "flex-start" }}>
    <Container variant="left">
      <FarmPanel />
    </Container>

    <Container variant="right"></Container>
  </Container>
);
