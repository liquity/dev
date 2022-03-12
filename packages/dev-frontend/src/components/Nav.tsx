import { Flex, Box } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Flex sx={{ justifyContent: "flex-center"}}>
        <Link to="/">Dashboard</Link>
        <Link to="/farm">Farm</Link>
        <Link to="/liquidate">Liquidate</Link>
      </Flex>
    </Box>
  );
};
