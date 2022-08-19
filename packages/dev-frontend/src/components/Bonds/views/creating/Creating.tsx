import React from "react";
import { ModalWizard } from "../../../ModalWizard";
import { ReactModal } from "../../../ReactModal";
import { useBondView } from "../../context/BondViewContext";
import { Information } from "./Information";
import { Details } from "./Details";

export const Creating: React.FC = () => {
  const { dispatchEvent } = useBondView();

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };
  const ignoreInformation =
    window.localStorage.getItem("LIQUITY_CREATE_BOND_MESSAGE_VISIBLE") === "true";

  return !ignoreInformation ? (
    <ModalWizard onDismiss={handleDismiss}>
      <Information />
      <Details />
    </ModalWizard>
  ) : (
    <ReactModal onDismiss={handleDismiss}>
      <Details />
    </ReactModal>
  );
};
