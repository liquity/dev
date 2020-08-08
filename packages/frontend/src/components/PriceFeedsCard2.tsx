import React from "react";
import { Card, Heading, SxProps, Box, Text } from "theme-ui";

export const PriceFeedsCard: React.FC<SxProps> = ({ sx }) => (
  <Card variant="new" {...{ sx }}>
    <Heading>Price Feeds</Heading>

    <Box>
      <Text sx={{ fontSize: 1 }}>ETH</Text>
      <Text sx={{ fontSize: 3, fontWeight: "medium" }}>$161.13</Text>
    </Box>

    <Box sx={{ mt: 4 }}>
      <Text sx={{ fontSize: 1 }}>LQTY</Text>
      <Text sx={{ fontSize: 3, fontWeight: "medium" }}>$1.01</Text>
    </Box>
  </Card>
);
