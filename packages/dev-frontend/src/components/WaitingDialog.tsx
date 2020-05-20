import React from "react";
import { Box, Flex, Loader } from "rimble-ui";

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
    <Box px={[3, 4]} pb={[3, 4]}>
      <Flex
        flexDirection={["column", "row"]}
        bg={"primary-2x-light"}
        p={[3, 4]}
        alignItems={["center", "auto"]}
      >
        <Loader size={"3em"} mr={[0, 3]} mb={[2, 0]} />
        <Flex flexDirection="column" alignItems={["center", "flex-start"]}>
          {waitReason}
        </Flex>
      </Flex>
    </Box>
  </Dialog>
);
