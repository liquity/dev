import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";

import { GT } from "../../strings";

import { Icon } from "../Icon";
import { useStakingView } from "./context/StakingViewContext";

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView();

  return (
    <Card>
      <Heading>Staking</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center" }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              You haven't staked {GT} yet
            </Heading>
          </Flex>

          <Text sx={{ fontSize: 2 }}>
            Stake {GT} to earn a share of borrowing and redemption fees
          </Text>
        </Box>

        <Flex variant="layout.actions">
          <Button onClick={() => dispatch({ type: "startAdjusting" })}>Start staking</Button>
        </Flex>
      </Box>
    </Card>
  );
};
