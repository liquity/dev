import React from "react";
import { Container } from "theme-ui";

type ModalProps = {
  children: JSX.Element;
  isOpen: boolean;
};

export const Modal: React.FC<ModalProps> = ({ children, isOpen }) =>
  isOpen ? (
    <Container variant="modalOverlay">
      <Container variant="modal">{children}</Container>
    </Container>
  ) : null;
