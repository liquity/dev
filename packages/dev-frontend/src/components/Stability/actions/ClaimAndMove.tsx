import React from "react";
import { Button } from "theme-ui";
import { useStabilio } from "../../../hooks/StabilioContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimAndMoveProps = {
  disabled?: boolean;
};

export const ClaimAndMove: React.FC<ClaimAndMoveProps> = ({ disabled, children }) => {
  const { stabilio } = useStabilio();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    stabilio.send.transferCollateralGainToTrove.bind(stabilio.send)
  );

  return (
    <Button
      variant="outline"
      sx={{ mt: 3, width: "98%", ml: 2 }}
      onClick={sendTransaction}
      disabled={disabled}
    >
      {children}
    </Button>
  );
};
