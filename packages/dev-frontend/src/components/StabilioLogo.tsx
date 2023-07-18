import React from "react";
import { Box, Image } from "theme-ui";

type StabilioLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const StabilioLogo: React.FC<StabilioLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./xbrl-icon.png" sx={{ height }} />
  </Box>
);
