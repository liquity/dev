import React from "react";
import { Box, Button, Flex } from "theme-ui";

import { Dialog } from "./Dialog";

type RetryDialogProps = {
  title: string;
  cancelLabel?: string;
  retryLabel?: string;
  onCancel: () => void;
  onRetry: () => void;
};

export const RetryDialog: React.FC<RetryDialogProps> = ({
  title,
  cancelLabel,
  onCancel,
  retryLabel,
  onRetry,
  children
}) => (
  <Dialog intent="danger" title={title} cancelLabel={cancelLabel} onCancel={onCancel}>
    <Box sx={{ p: [3, 4] }}>{children}</Box>
    <Flex
      sx={{
        p: [3, 4],
        borderTop: 1,
        borderColor: "muted",
        justifyContent: "flex-end",
        flexDirection: ["column", "row"],
        alignItems: "center"
      }}
    >
      <Button
        variant="danger"
        sx={{
          mr: [0, 3],
          mb: [2, 0],
          width: ["100%", "auto"]
        }}
        onClick={onCancel}
      >
        {cancelLabel || "Cancel"}
      </Button>
      <Button sx={{ width: ["100%", "auto"] }} onClick={onRetry}>
        {retryLabel || "Retry"}
      </Button>
    </Flex>
  </Dialog>
);
