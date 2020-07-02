import React from "react";
import { Box, Flex } from "theme-ui";

import { LiquityLogo } from "./LiquityLogo";

export const AccessibleLiquityLogo: React.FC = () => (
  <Flex sx={{ lineHeight: 0.88 }}>
    <LiquityLogo height="1em" role="img" aria-labelledby="liquity-logo-title">
      <title id="liquity-logo-title">Liquity Logo</title>
    </LiquityLogo>

    <Box
      as="h1"
      sx={{
        display: ["none", "block"],
        ml: "0.16em",
        fontSize: "inherit",
        fontFamily: "heading",
        fontWeight: "regular",
        letterSpacing: "-0.005em"
      }}
    >
      Liquity
    </Box>
  </Flex>
);
