import React from "react";
import { ReactModal } from "../../../ReactModal";
import { useBondView } from "../../context/BondViewContext";
import { SwapPane } from "./SwapPane";

export const Swapping: React.FC = () => {
  const { dispatchEvent } = useBondView();

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  return (
    <ReactModal onDismiss={handleDismiss}>
      <SwapPane />
    </ReactModal>
  );
};
