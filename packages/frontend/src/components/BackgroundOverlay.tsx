import React from "react";
import { Flex, SxProps } from "theme-ui";

export const BackgroundOverlay: React.FC<SxProps> = ({ sx, children }) => (
  <Flex
    sx={{
      justifyContent: "center",
      alignItems: "center",

      position: "absolute",
      zIndex: -1,
      top: ["12%", 0],
      width: "100%",
      height: ["88%", "100%"],

      color: "text",
      fontSize: "10em",
      opacity: 0.05,

      ...sx
    }}
  >
    {children}
  </Flex>
);
