import { Heading, Box, Card, Flex, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { DisabledEditableRow, Row, StaticAmounts } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { Icon } from "../Icon";

import { useStakingView } from "./context/StakingViewContext";
import { StakingGainsAction } from "./StakingGainsAction";

const selectLQTYStake = ({ lqtyStake }: LiquityStoreState) => lqtyStake;

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView();
  const lqtyStake = useLiquitySelector(selectLQTYStake);

  return (
    <Card>
      <Heading>Staking</Heading>

      <Box sx={{ p: [2, 3] }}>
        <DisabledEditableRow
          label="Stake"
          inputId="stake-lqty"
          amount={lqtyStake.stakedLQTY.prettify()}
          unit={GT}
        />

        <Row label="Gains" sx={{ flexDirection: "column", mt: [-2, -3], pb: [2, 3] }}>
          <StaticAmounts
            inputId="stake-gain-eth"
            amount={lqtyStake.collateralGain.prettify(4)}
            color={lqtyStake.collateralGain.nonZero && "success"}
            unit="ETH"
            sx={{ mb: 0 }}
          />

          <StaticAmounts
            inputId="stake-gain-lusd"
            amount={lqtyStake.lusdGain.prettify()}
            color={lqtyStake.lusdGain.nonZero && "success"}
            unit={COIN}
            sx={{ pt: 0 }}
          />
        </Row>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={() => dispatch({ type: "startAdjusting" })}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <StakingGainsAction />
        </Flex>
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
