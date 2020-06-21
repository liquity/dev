import React from "react";
import { Container } from "theme-ui";

export const Footer: React.FC = ({ children }) => (
  <Container variant="footer" id="footnote">
    {children}
  </Container>
);
