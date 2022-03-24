import { Box, Flex, Text } from "theme-ui";

import { Icon } from "./Icon";

export const ActionDescription: React.FC = ({ children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",

      mb: [2, 3],
      p: 3,

      border: 1,
      borderRadius: 16,
      borderColor: "accent",
      // boxShadow: 1,
      bg: "#f9fffe",
    }}
  >
    <Flex sx={{ alignItems: "center" }}>
      <Icon name="info-circle" size="lg" />
      <Text sx={{ ml: 2 }}>{children}</Text>
    </Flex>
  </Box>
);

export const Amount: React.FC = ({ children }) => (
  <Text sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{children}</Text>
);
