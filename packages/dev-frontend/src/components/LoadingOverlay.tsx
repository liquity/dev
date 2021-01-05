import React from "react";
import { Container, Spinner } from "theme-ui";

export const LoadingOverlay: React.FC = () => (
  <Container
    variant="disabledOverlay"
    sx={{ p: "14px", display: "flex", justifyContent: "flex-end" }}
  >
    <Spinner size="28px" sx={{ color: "text" }} />
  </Container>
);
