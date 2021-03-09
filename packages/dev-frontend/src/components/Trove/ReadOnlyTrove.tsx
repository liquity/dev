import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { useLiquitySelector } from "@liquity/lib-react";
import type { Trove } from "@liquity/lib-base";
import {
  LiquityStoreState,
  Percent,
  CRITICAL_COLLATERAL_RATIO,
  MINIMUM_COLLATERAL_RATIO
} from "@liquity/lib-base";
import { StaticRow } from "./Editor";
import { useTroveView } from "./context/TroveViewContext";

const selectPrice = ({ price, trove }: LiquityStoreState) => ({ price, trove });

export const ReadOnlyTrove: React.FC = props => {
  const { recordEvent } = useTroveView();
  const handleAdjustTrove = useCallback(() => {
    recordEvent("ADJUST_TROVE");
  }, []);

  const { price, trove } = useLiquitySelector(selectPrice);
  const collateralRatio = trove.collateralRatio(price);
  const collateralRatioPct = new Percent(collateralRatio);
  const prettyCollateralRatio = collateralRatio?.gt(10)
    ? "× " + collateralRatio.shorten()
    : collateralRatioPct.prettify();
  return (
    <Card>
      <Heading>Trove</Heading>
      <Box>
        <Box>
          <StaticRow
            label="Collateral"
            inputId="trove-collateral"
            amount={trove.collateral.prettify(4)}
            unit="ETH"
          />
          <StaticRow label="Debt" inputId="trove-debt" amount={trove.debt.prettify(4)} unit="LUSD" />
          <StaticRow
            label="Collateral ratio"
            inputId="trove-collateral-ratio"
            amount={prettyCollateralRatio}
            color={
              collateralRatio?.gt(CRITICAL_COLLATERAL_RATIO)
                ? "success"
                : collateralRatio?.gt(MINIMUM_COLLATERAL_RATIO)
                ? "warning"
                : collateralRatio?.lte(MINIMUM_COLLATERAL_RATIO)
                ? "danger"
                : "muted"
            }
          />
        </Box>

        <Flex variant="layout.actions">
          <Button onClick={handleAdjustTrove}>Adjust</Button>
        </Flex>
      </Box>
    </Card>
  );
};
