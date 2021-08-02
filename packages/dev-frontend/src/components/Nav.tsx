import { Flex, Box } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link className="hide" to="/">Dashboard</Link>
        <Link className="hide" to="/farm">Farm</Link>
      </Flex>
      <Flex sx={{ justifyContent: "flex-end", mr: 3, flex: 1 }}>
        <Link  className="hide" sx={{ fontSize: 1 }} to="/risky-troves">
          Risky Troves
        </Link>
        <Link className="hide" sx={{ fontSize: 1 }} to="/redemption">
          Redemption
        </Link>
      </Flex>
    </Box>
  );
};
