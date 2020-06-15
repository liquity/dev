import React from "react";
import { Text, Box } from "theme-ui";

import { WaitingDialog } from "./WaitingDialog";

type ConnectionConfirmationDialogProps = {
  title: string;
  icon?: React.ReactNode;
  onCancel: () => void;
};

export const ConnectionConfirmationDialog: React.FC<ConnectionConfirmationDialogProps> = ({
  title,
  icon,
  onCancel,
  children
}) => (
  <WaitingDialog
    title={title}
    icon={icon}
    waitReason={
      <>
        <Text sx={{ fontWeight: 4 }}>Waiting for connection confirmation...</Text>
        <Text sx={{ fontWeight: 2 }}>This won’t cost you any Ether</Text>
      </>
    }
    cancelLabel="Cancel connection"
    onCancel={onCancel}
  >
    <Box p={[3, 4]}>{children}</Box>
  </WaitingDialog>
);
