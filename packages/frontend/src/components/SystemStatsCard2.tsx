import React from "react";
import { Card, Heading, SxProps, Box, Text } from "theme-ui";

export const SystemStatsCard: React.FC<SxProps> = ({ sx }) => (
  <Card
    variant="new"
    sx={{
      width: "280px",

      "::before": {
        content: '""',
        display: "block",

        m: -6,
        mb: 6,
        pt: 3,

        background: "linear-gradient(55deg, rgba(53, 190, 237, 0.5), rgb(128, 104, 227, 0.5))",
        borderTopLeftRadius: 1,
        borderTopRightRadius: 1
      },

      ...sx
    }}
  >
    <Heading>Liquity System</Heading>

    {[
      ["Total collateral ratio", "311%"],
      ["Total LQTY supply", "7.48M"],
      ["LQTY in Stability Pool", "1.35M"],
      ["% of LQTY in Stability Pool", "18%"],
      ["Number of Troves", "3421"]
    ].map(([label, text], i) => (
      <Box key={i} sx={i ? { mt: 4 } : {}}>
        <Text sx={{ fontSize: 1 }}>{label}</Text>
        <Text sx={{ fontSize: 3, fontWeight: "medium" }}>{text}</Text>
      </Box>
    ))}
  </Card>
);
