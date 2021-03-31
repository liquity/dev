import { Box, Flex, Heading, Text } from "theme-ui";

import { Icon } from "./Icon";

type InfoMessageProps = {
  title: string;
  icon?: React.ReactNode;
};

export const InfoMessage: React.FC<InfoMessageProps> = ({ title, children, icon }) => (
  <Box sx={{ mx: 1, mb: 3 }}>
    <Flex sx={{ alignItems: "center", mb: "10px" }}>
      <Box sx={{ mr: "12px", fontSize: "20px" }}>{icon || <Icon name="info-circle" />}</Box>

      <Heading as="h3">{title}</Heading>
    </Flex>

    <Text sx={{ fontSize: 2 }}>{children}</Text>
  </Box>
);
