import React, { useCallback, useEffect } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";
import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { useMyTransactionState } from "../Transaction";
import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { ClaimAndMove } from "./actions/ClaimAndMove";
import { ClaimRewards } from "./actions/ClaimRewards";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";
import { InfoIcon } from "../InfoIcon";

const selector = ({ stabilityDeposit, trove, lusdInStabilityPool }: LiquityStoreState) => ({
  stabilityDeposit,
  trove,
  lusdInStabilityPool
});

export const ActiveDeposit: React.FC = () => {
  const { dispatchEvent } = useStabilityView();
  const { stabilityDeposit, trove, lusdInStabilityPool } = useLiquitySelector(selector);

  const {poolShare, bammPoolShare} = stabilityDeposit

  const handleAdjustDeposit = useCallback(() => {
    dispatchEvent("ADJUST_DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const hasReward = !stabilityDeposit.lqtyReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;
  const hasTrove = !trove.isEmpty;

  const transactionId = "stability-deposit";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("REWARDS_CLAIMED");
    }
  }, [transactionState.type, dispatchEvent]);

  const ethDiffInUsd = stabilityDeposit.currentUSD.sub(stabilityDeposit.currentLUSD)
  const ethIsImportant = (ethDiffInUsd.div(stabilityDeposit.currentUSD)).gt(1/1000)
  return (
    <Card>
      <Heading>
        Stability Pool
        {!isWaitingForTransaction && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingLQTY />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Deposit"
            inputId="deposit-lusd"
            amount={stabilityDeposit.currentUSD.prettify()}
            unit={COIN}
          />
          <Flex sx={{ justifyContent: 'space-between', flexWrap: "wrap" }}>
            <StaticRow
              label="LUSD balance"
              inputId="deposit-gain"
              amount={stabilityDeposit.currentLUSD.prettify(2)}
              unit="LUSD"
            />
            {ethIsImportant &&
              <StaticRow
                label="ETH balance"
                inputId="deposit-gain"
                amount={stabilityDeposit.collateralGain.prettify(4)}
                unit="ETH"
                infoIcon={
                  <InfoIcon
                    tooltip={
                      <Card variant="tooltip" sx={{ width: "240px" }}>
                        Temporary ETH balance until rebalance takes place
                      </Card>
                    }
                  />
                }
              />
            }
          </Flex>

          <StaticRow
            label="Pool share"
            inputId="deposit-share"
            amount={poolShare.prettify(4)}
            unit="%"
          />
          <div className="hide" >
            <StaticRow
              label="BAMM Pool share"
              inputId="deposit-share"
              amount={bammPoolShare.prettify(4)}
              unit="%"
            />
          </div>
          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={stabilityDeposit.lqtyReward.prettify()}
              color={stabilityDeposit.lqtyReward.nonZero && "success"}
              unit={GT}
              infoIcon={
                <InfoIcon
                  tooltip={
                    <Card variant="tooltip" sx={{ width: "240px" }}>
                      Although the LQTY rewards accrue every minute, the value on the UI only updates
                      when a user transacts with the Stability Pool. Therefore you may receive more
                      rewards than is displayed when you claim or adjust your deposit.
                    </Card>
                  }
                />
              }
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleAdjustDeposit}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <ClaimRewards disabled={!hasGain && !hasReward}>Claim LQTY</ClaimRewards>
        </Flex>

      </Box>

      {isWaitingForTransaction && <LoadingOverlay />}
    </Card>
  );
};
