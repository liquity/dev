import React from "react";
import { Flex, Text, Input, Button, IconButton } from "theme-ui";

import { Icon } from "../components/Icon";
import { IndicatorWidget, IndicatorLabel } from "../components/IndicatorWidget";
import { BackgroundOverlay } from "../components/BackgroundOverlay";
import { Form } from "../components/Form";
import { Field, Label, Unit } from "../components/Field";
import { RelativeLink } from "../utils/routing";

export const BorrowPage: React.FC = () => (
  <Form sx={{ maxHeight: ["650px", "500px"] }}>
    <BackgroundOverlay>
      <Icon name="lock" />
    </BackgroundOverlay>

    <Flex
      sx={{
        justifyContent: "space-around",
        width: "100%"
      }}
    >
      <IndicatorWidget>
        <Icon name="percent" />
        <IndicatorLabel>Collateral ratio</IndicatorLabel>
        <Text sx={{ color: "success" }}>202.0%</Text>
      </IndicatorWidget>

      <IndicatorWidget>
        <Icon name="exclamation-circle" size="lg" />
        <IndicatorLabel>Liquidation price</IndicatorLabel>
        <Text>$87.74</Text>
      </IndicatorWidget>
    </Flex>

    <Field id="trove-collateral">
      <Label>Collateral</Label>
      <Input value="12.5390" disabled />
      <Unit>
        ETH
        <IconButton aria-label="Change currency">
          <Icon name="retweet" size="lg" />
        </IconButton>
      </Unit>
    </Field>

    <Field id="trove-debt">
      <Label>Outstanding debt</Label>
      <Input value="1000.00" disabled />
      <Unit>LQTY</Unit>
    </Field>

    <RelativeLink to="dialog/changeTrove">
      <Button>
        <Icon name="unlock" />
        Make changes
      </Button>
    </RelativeLink>
  </Form>
);
