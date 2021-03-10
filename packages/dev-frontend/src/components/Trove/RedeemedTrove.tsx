import React, { useCallback } from "react";
import { Card, Heading, Box, Button, Flex, Text } from "theme-ui";
import { Icon } from "../Icon";
import { CollateralSurplusAction } from "../CollateralSurplusAction";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useTroveView } from "./context/TroveViewContext";

const select = ({ collateralSurplusBalance }: LiquityStoreState) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

export const RedeemedTrove: React.FC = () => {
  const { hasSurplusCollateral } = useLiquitySelector(select);
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Trove</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center" }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              Your Trove has been redeemed
            </Heading>
          </Flex>

          {hasSurplusCollateral && (
            <Text sx={{ fontSize: 2 }}>
              Please reclaim your remaining collateral before opening a new Trove
            </Text>
          )}
          {!hasSurplusCollateral && (
            <Text sx={{ fontSize: 2 }}>You can borrow LUSD by opening a Trove</Text>
          )}
        </Box>

        <Flex variant="layout.actions">
          {hasSurplusCollateral && <CollateralSurplusAction />}
          {!hasSurplusCollateral && <Button onClick={handleOpenTrove}>Open Trove</Button>}
        </Flex>
      </Box>
    </Card>
  );
};
