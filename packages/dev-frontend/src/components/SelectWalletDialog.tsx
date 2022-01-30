import React from "react";
import { Text, Box } from "theme-ui";

import { WaitingDialog } from "./WaitingDialog";
import { Dialog } from "./Dialog";

type SelectWalletDialogProps = {
  onCancel: () => void;
};

export const SelectWalletDialog: React.FC<SelectWalletDialogProps> = ({
  children,
  onCancel
}) => (
  <Dialog
    title={"Select a Wallet"}
    onCancel={onCancel}
  >
  <Box sx={{ p: [4, 4] }}>{children}</Box>
  </Dialog>
);
