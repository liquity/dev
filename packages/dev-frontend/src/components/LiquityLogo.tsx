import React from "react";
import { Box, Image } from "theme-ui";

type LiquityLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const LiquityLogo: React.FC<LiquityLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./lusd-icon.png" sx={{ height }} />
  </Box>
);
