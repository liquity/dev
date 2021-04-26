import React from "react";
import { Flex, Box, Card } from "theme-ui";

import { CRITICAL_COLLATERAL_RATIO, Decimal, Percent } from "@liquity/lib-base";

import { Icon } from "../Icon";

import { StaticRow } from "./Editor";
import { InfoIcon } from "../InfoIcon";
import { ActionDescription } from "../ActionDescription";

type CollateralRatioProps = {
  value?: Decimal;
};

export const CollateralRatio: React.FC<CollateralRatioProps> = ({ value }) => {
  const collateralRatioPct = new Percent(value ?? { toString: () => "N/A" });

  return (
    <>
      <Flex>
        <Box sx={{ mt: [2, 0], ml: 3, mr: -2, fontSize: "24px" }}>
          <Icon name="heartbeat" />
        </Box>

        <StaticRow
          label="Collateral ratio"
          inputId="trove-collateral-ratio"
          amount={collateralRatioPct.toString(0)}
          color={
            value?.gt(CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : value?.gt(1.2)
              ? "warning"
              : value?.lte(1.2)
              ? "danger"
              : "muted"
          }
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "220px" }}>
                  The ratio between the dollar value of the collateral and the debt (in LUSD) you are
                  depositing. While the Minimum Collateral Ratio is 110% during normal operation, it
                  is recommended to keep the Collateral Ratio always above 150% to avoid liquidation
                  under Recovery Mode. A Collateral Ratio above 200% or 250% is recommended for
                  additional safety.
                </Card>
              }
            />
          }
        />
      </Flex>
      {value?.lt(1.5) && (
        <ActionDescription>
          Keeping your CR above 150% can help avoid liquidation under Recovery Mode.
        </ActionDescription>
      )}
    </>
  );
};
