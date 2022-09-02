import React from "react";
import { Close, Flex, Heading } from "theme-ui";
import { ReactModal } from "../../../ReactModal";
import { useBondView } from "../../context/BondViewContext";
import { DepositPane } from "./DepositPane";

export const AddingLiquidity: React.FC = () => {
  const { dispatchEvent } = useBondView();

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  return (
    <ReactModal onDismiss={handleDismiss}>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>Add liquidity</Flex>

        <Close
          onClick={handleDismiss}
          sx={{
            position: "absolute",
            right: "24px",
            top: "24px"
          }}
        />
      </Heading>

      <DepositPane />
    </ReactModal>
  );
};
