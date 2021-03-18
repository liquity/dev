import React, { useState } from "react";
import { Button, Box, Flex, Card, Heading } from "theme-ui";

import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../strings";

import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { ActionDescription } from "../ActionDescription";

import { RedemptionAction } from "./RedemptionAction";

const select = ({ price, fees, total }: LiquityStoreState) => ({
  price,
  fees,
  total
});

export const RedemptionManager: React.FC = () => {
  const { price, fees, total } = useLiquitySelector(select);
  const [lusdAmount, setLUSDAmount] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);
  const editingState = useState<string>();

  const edited = !lusdAmount.isZero;
  const ethAmount = lusdAmount.div(price);
  const redemptionRate = fees.redemptionRate(lusdAmount.div(total.debt));
  const feePct = new Percent(redemptionRate);
  const ethFee = ethAmount.mul(redemptionRate);
  const maxRedemptionRate = redemptionRate.add(0.001); // TODO slippage tolerance

  return (
    <>
      <Card>
        <Heading>
          Redemption
          {edited && !changePending && (
            <Button
              variant="titleIcon"
              sx={{ ":enabled:hover": { color: "danger" } }}
              onClick={() => setLUSDAmount(Decimal.ZERO)}
            >
              <Icon name="history" size="lg" />
            </Button>
          )}
        </Heading>

        <Box sx={{ p: [2, 3] }}>
          <EditableRow
            label="Redeem"
            inputId="redeem-lusd"
            amount={lusdAmount.prettify()}
            unit={COIN}
            {...{ editingState }}
            editedAmount={lusdAmount.toString(2)}
            setEditedAmount={amount => setLUSDAmount(Decimal.from(amount))}
          />

          {edited && (
            <>
              <StaticRow
                label="Fee"
                inputId="redeem-fee"
                amount={ethFee.toString(4)}
                pendingAmount={feePct.toString(2)}
                unit="ETH"
              />

              <ActionDescription>
                You will receive {ethAmount.sub(ethFee).prettify(4)} ETH in exchange for{" "}
                {lusdAmount.prettify()} {COIN}.
              </ActionDescription>
            </>
          )}

          <Flex variant="layout.actions">
            <RedemptionAction
              {...{ lusdAmount, setLUSDAmount, changePending, setChangePending, maxRedemptionRate }}
            />
          </Flex>
        </Box>

        {changePending && <LoadingOverlay />}
      </Card>
    </>
  );
};
