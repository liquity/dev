import React from "react";
import { Flex, Card } from "theme-ui";
import { InfoIcon } from "./InfoIcon";

type StatisticProps = {
  name: React.ReactNode;
  tooltip: React.ReactNode;
};

export const Statistic: React.FC<StatisticProps> = ({ name, tooltip, children }) => {
  return (
    <Flex sx={{ borderBottom: 1, borderColor: "rgba(0, 0, 0, 0.1)" }}>
      <Flex sx={{ alignItems: "center", justifyContent: "flex-start", flex: 1.1, fontWeight: 200 }}>
        <Flex>{name}</Flex>
        <InfoIcon size="xs" tooltip={<Card variant="tooltip">{tooltip}</Card>} />
      </Flex>
      <Flex sx={{ justifyContent: "flex-start", flex: 0.9, alignItems: "center" }}>{children}</Flex>
    </Flex>
  );
};
