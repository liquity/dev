import React from "react";
import { Container } from "theme-ui";

export const Modal: React.FC = ({ children }) => (
  <Container variant="modalOverlay">
    <Container variant="modal">{children}</Container>
  </Container>
);
