import React from "react";
import { Flex, Card, Heading, Box, Text } from "theme-ui";

type StatisticProps = {
  name: React.ReactNode;
  tooltip?: React.ReactNode;
  variant?: string;
};

export const BigStatistic: React.FC<StatisticProps> = ({ variant = "info", name, tooltip, children }) => {
  return (
    <Card {...{ variant }}
      sx={{
        color: "accent",
      }}>
      <Text sx={{
        display: "flex",
        justifyContent: "center",
        // flexWrap: "wrap",
      }}>{name}</Text>
      <Text sx={{
        fontSize: "x-large",
        fontWeight: "bold",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>{children}</Text>
    </Card>
  );
};
