import { Flex } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Flex as="nav" sx={{ flexWrap: "wrap" }}>
      <Link to="/">Dashboard</Link>
      <Link to="/farm">Farm</Link>
      <Link to="/liquidation">Liquidation</Link>
      <Link to="/redemption">Redemption</Link>
    </Flex>
  );
};
