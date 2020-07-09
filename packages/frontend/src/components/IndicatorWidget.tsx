import React from "react";
import { Flex, Box, Text, SxProps } from "theme-ui";

export const IndicatorWidget: React.FC<SxProps> = ({ sx, children }) => {
  const [firstChild, ...restOfChildren] = React.Children.toArray(children);

  return (
    <Flex
      sx={{
        alignItems: "center",

        fontSize: [2, 3],
        fontWeight: "medium",

        ...sx
      }}
    >
      {firstChild}

      <Box sx={{ ml: [4, 5] }}>{restOfChildren}</Box>
    </Flex>
  );
};

export const IndicatorLabel: React.FC = ({ children }) => (
  <Text sx={{ fontSize: [0, 1], fontWeight: "body" }}>{children}</Text>
);
