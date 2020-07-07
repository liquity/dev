import React from "react";
import { Heading, SxProps } from "theme-ui";

export const Title: React.FC<SxProps> = ({ sx, children }) => (
  <Heading
    variant="caps"
    sx={{
      fontSize: "0.5em",
      lineHeight: 2.2,

      ...sx
    }}
  >
    {children}
  </Heading>
);
