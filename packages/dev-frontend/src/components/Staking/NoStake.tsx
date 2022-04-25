import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { GT } from "../../strings";

import { InfoMessage } from "../InfoMessage";
import { useStakingView } from "./context/StakingViewContext";

export const NoStake: React.FC = () => {
  const { dispatch } = useStakingView();

  return (
    <Card>
      <Heading>Apostar</Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title={`Todavía no has apostado ${GT} `}>
          Apuesta {GT} para ganar una parte de las tarifas de préstamo y reembolso
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={() => dispatch({ type: "startAdjusting" })}>Comenzar a Apostar</Button>
        </Flex>
      </Box>
    </Card>
  );
};
