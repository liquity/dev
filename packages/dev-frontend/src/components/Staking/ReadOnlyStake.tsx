import { Heading, Box, Card, Flex, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

import { useStakingView } from "./context/StakingViewContext";
import { StakingGainsAction } from "./StakingGainsAction";

const selectLQTYStake = ({ lqtyStake }: LiquityStoreState) => lqtyStake;

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView();
  const lqtyStake = useLiquitySelector(selectLQTYStake);

  return (
    <Card>
      <Heading>Staking</Heading>

      {changePending && <LoadingOverlay />}

      <Box>
        <StaticRow
          label="Stake"
          inputId="stake-lqty"
          amount={lqtyStake.stakedLQTY.prettify()}
          unit={GT}
        />

        <StaticRow
          label="Gain"
          inputId="stake-gain-eth"
          amount={lqtyStake.collateralGain.prettify(4)}
          color={lqtyStake.collateralGain.nonZero && "success"}
          unit="ETH"
        />

        <StaticRow
          label="Gain"
          inputId="stake-gain-lusd"
          amount={lqtyStake.lusdGain.prettify()}
          color={lqtyStake.lusdGain.nonZero && "success"}
          unit={COIN}
        />

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={() => dispatch({ type: "startAdjusting" })}>
            Adjust
          </Button>

          <StakingGainsAction />
        </Flex>
      </Box>
    </Card>
  );
};
