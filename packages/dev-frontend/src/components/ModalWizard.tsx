import React from "react";
import { ReactModal } from "./ReactModal";
import { Wizard } from "./Wizard/Wizard";
import type { WizardProviderProps } from "./Wizard/Context";

type ModalWizardProps = WizardProviderProps & {
  onDismiss: () => void;
  style?: React.CSSProperties;
};

export const ModalWizard: React.FC<ModalWizardProps> = ({ children, onDismiss, style }) => {
  const handleDismiss = () => onDismiss();

  return (
    <ReactModal onDismiss={handleDismiss} style={style}>
      <Wizard onCancel={onDismiss}>{children}</Wizard>
    </ReactModal>
  );
};
