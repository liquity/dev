import React from "react";
import { Box, Flex, Spinner } from "theme-ui";

import { Dialog } from "./Dialog";

type WaitingDialogProps = {
  title: string;
  icon?: React.ReactNode;
  waitReason: React.ReactNode;
  cancelLabel?: string;
  onCancel: () => void;
};

export const WaitingDialog: React.FC<WaitingDialogProps> = ({
  title,
  icon,
  waitReason,
  cancelLabel,
  onCancel,
  children
}) => (
  <Dialog title={title} icon={icon} cancelLabel={cancelLabel} onCancel={onCancel}>
    {children}
    <Box sx={{ px: [3, 4], pb: [3, 4] }}>
      <Flex
        sx={{
          flexDirection: ["column", "row"],
          bg: "muted",
          p: [3, 4],
          alignItems: ["center", "auto"]
        }}
      >
        <Spinner size="3em" sx={{ mr: [0, 3], mb: [2, 0] }} />
        <Flex sx={{ flexDirection: "column", alignItems: ["center", "flex-start"] }}>
          {waitReason}
        </Flex>
      </Flex>
    </Box>
  </Dialog>
);
