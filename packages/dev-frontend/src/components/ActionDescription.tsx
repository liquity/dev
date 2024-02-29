import { Box, Flex, Text } from "theme-ui";

export const ActionDescription: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",

      mb: [2, 3],
      p: 3,

      border: 1,
      borderColor: "transparent"
    }}
  >
    <Flex sx={{ alignItems: "center" }}>
      <Text>{children}</Text>
    </Flex>
  </Box>
);

export const Amount: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Text sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{children}</Text>
);
