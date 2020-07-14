import React from "react";
import { IconButton, SxProps } from "theme-ui";

import { Icon } from "./Icon";

export const MoreInfoButton: React.FC<SxProps> = ({ sx }) => (
  <IconButton variant="cardlike" sx={{ p: 0, ...sx }}>
    <Icon name="info" size="xs" aria-label="More information" aria-hidden={false} />
  </IconButton>
);
