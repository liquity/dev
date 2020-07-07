import React from "react";
import { IconButton } from "theme-ui";

import { Icon } from "./Icon";

export const MoreInfoButton: React.FC = () => (
  <IconButton variant="cardlike" sx={{ p: 0 }}>
    <Icon name="info" size="xs" aria-label="More information" aria-hidden={false} />
  </IconButton>
);
