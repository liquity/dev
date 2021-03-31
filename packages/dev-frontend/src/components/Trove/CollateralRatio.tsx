import React from "react";
import { Flex, Box, Card } from "theme-ui";

import {
  CRITICAL_COLLATERAL_RATIO,
  Decimal,
  Difference,
  MINIMUM_COLLATERAL_RATIO,
  Percent
} from "@liquity/lib-base";

import { Icon } from "../Icon";

import { StaticRow } from "./Editor";
import { InfoIcon } from "../InfoIcon";

type CollateralRatioProps = {
  value?: Decimal;
  change?: Difference;
};

export const CollateralRatio: React.FC<CollateralRatioProps> = ({ value, change }) => {
  const collateralRatioPct = new Percent(value ?? { toString: () => "N/A" });
  const changePct = change && new Percent(change);

  return (
    <Flex>
      <Box sx={{ mt: [2, 0], ml: 3, mr: -2, fontSize: "24px" }}>
        <Icon name="heartbeat" />
      </Box>

      <StaticRow
        label="Collateral ratio"
        inputId="trove-collateral-ratio"
        amount={collateralRatioPct.prettify()}
        color={
          value?.gt(CRITICAL_COLLATERAL_RATIO)
            ? "success"
            : value?.gt(MINIMUM_COLLATERAL_RATIO)
            ? "warning"
            : value?.lte(MINIMUM_COLLATERAL_RATIO)
            ? "danger"
            : "muted"
        }
        pendingAmount={
          change?.positive?.absoluteValue?.gt(10)
            ? "++"
            : change?.negative?.absoluteValue?.gt(10)
            ? "--"
            : changePct?.nonZeroish(2)?.prettify()
        }
        pendingColor={change?.positive ? "success" : "danger"}
        infoIcon={
          <InfoIcon
            tooltip={
              <Card variant="tooltip" sx={{ width: "220px" }}>
                This is the ratio between the dollar value of the collateral and debt you are
                depositing.
              </Card>
            }
          />
        }
      />
    </Flex>
  );
};
