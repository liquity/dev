import { Box, Flex, Heading, Text } from "theme-ui";

import { Icon } from "./Icon";

type InfoMessageProps = {
  title: string;
};

export const InfoMessage: React.FC<InfoMessageProps> = ({ title, children }) => (
  <Box sx={{ mx: 1, mb: 3 }}>
    <Flex sx={{ alignItems: "center", mb: "10px" }}>
      <Box sx={{ mr: "12px", fontSize: "20px" }}>
        <Icon name="info-circle" />
      </Box>

      <Heading as="h3">{title}</Heading>
    </Flex>

    <Text sx={{ fontSize: 2 }}>{children}</Text>
  </Box>
);
