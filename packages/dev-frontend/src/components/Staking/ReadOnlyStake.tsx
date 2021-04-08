import { Heading, Box, Card, Flex, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { Icon } from "../Icon";

import { useStakingView } from "./context/StakingViewContext";
import { StakingGainsAction } from "./StakingGainsAction";

const select = ({ lqtyStake, totalStakedLQTY }: LiquityStoreState) => ({
  lqtyStake,
  totalStakedLQTY
});

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView();
  const { lqtyStake, totalStakedLQTY } = useLiquitySelector(select);

  const poolShare = lqtyStake.stakedLQTY.mulDiv(100, totalStakedLQTY);

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

        <StaticRow
          label="Pool share"
          inputId="stake-share"
          amount={poolShare.prettify(4)}
          unit="%"
        />

        <StaticRow
          label="Redemption gain"
          inputId="stake-gain-eth"
          amount={lqtyStake.collateralGain.prettify(4)}
          color={lqtyStake.collateralGain.nonZero && "success"}
          unit="ETH"
        />

        <StaticRow
          label="Issuance gain"
          inputId="stake-gain-lusd"
          amount={lqtyStake.lusdGain.prettify()}
          color={lqtyStake.lusdGain.nonZero && "success"}
          unit={COIN}
        />

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
