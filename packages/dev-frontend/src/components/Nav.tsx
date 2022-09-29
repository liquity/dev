import { Flex, Box, Badge, Text } from "theme-ui";
import { Link } from "./Link";

const TemporaryNewBadge = () => {
  const isBeforeNovember2022 = new Date() < new Date("2022-11-01");
  if (!isBeforeNovember2022) return null;
  return (
    <Badge ml={1} sx={{ fontSize: "12px" }}>
      New
    </Badge>
  );
};

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link to="/">Dashboard</Link>
        <Link to="/bonds">
          <Flex sx={{ alignItems: "center" }}>
            <Text>Bonds</Text>
            <TemporaryNewBadge />
          </Flex>
        </Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", mr: 3, flex: 1 }}>
        <Link sx={{ fontSize: 1 }} to="/risky-troves">
          Risky Troves
        </Link>
      </Flex>
    </Box>
  );
};
