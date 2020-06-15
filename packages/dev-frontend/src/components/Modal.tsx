import React from "react";
import Popup from "reactjs-popup";

type ModalProps = {
  children: JSX.Element;
  isOpen: boolean;
};

export const Modal: React.FC<ModalProps> = ({ children, isOpen }) => (
  <Popup open={isOpen} closeOnDocumentClick={false}>
    {children}
  </Popup>
);
