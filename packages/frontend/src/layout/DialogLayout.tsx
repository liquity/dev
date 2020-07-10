import React from "react";
import { Flex } from "theme-ui";

export const DialogLayout: React.FC = ({ children }) => {
  return (
    <Flex
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%"
      }}
    >
      {children}
    </Flex>
  );
};
