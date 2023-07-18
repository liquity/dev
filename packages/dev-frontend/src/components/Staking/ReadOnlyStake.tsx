import { Heading, Box, Card, Flex, Button } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

import { COIN, GT } from "../../strings";

import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { Icon } from "../Icon";

import { useStakingView } from "./context/StakingViewContext";
import { StakingGainsAction } from "./StakingGainsAction";

const select = ({ stblStake, totalStakedSTBL }: StabilioStoreState) => ({
  stblStake,
  totalStakedSTBL
});

export const ReadOnlyStake: React.FC = () => {
  const { changePending, dispatch } = useStakingView();
  const { stblStake, totalStakedSTBL } = useStabilioSelector(select);

  const poolShare = stblStake.stakedSTBL.mulDiv(100, totalStakedSTBL);

  return (
    <Card>
      <Heading>Staking</Heading>

      <Box sx={{ p: [2, 3] }}>
        <DisabledEditableRow
          label="Stake"
          inputId="stake-stbl"
          amount={stblStake.stakedSTBL.prettify()}
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
          amount={stblStake.collateralGain.prettify(4)}
          color={stblStake.collateralGain.nonZero && "success"}
          unit="ETH"
        />

        <StaticRow
          label="Issuance gain"
          inputId="stake-gain-xbrl"
          amount={stblStake.xbrlGain.prettify()}
          color={stblStake.xbrlGain.nonZero && "success"}
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
