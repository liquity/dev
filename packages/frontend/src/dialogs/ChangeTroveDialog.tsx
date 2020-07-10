import React from "react";
import { Input, Text, Flex } from "theme-ui";

import { Form } from "../components/Form";
import { Title } from "../components/Title";
import { Field, Label, Unit } from "../components/Field";
import { IndicatorLabel, IndicatorWidget } from "../components/IndicatorWidget";
import { Icon } from "../components/Icon";

export const ChangeTroveDialog: React.FC = () => (
  <Form>
    <Title>Change my Trove</Title>

    <Field id="change-trove-collateral">
      <Label>I want to top-up</Label>
      <Input value="3.500" />
      <Unit>ETH</Unit>
    </Field>

    <Text>Balance: 10.45 → 6.95 ETH</Text>

    <Field id="change-trove-debt">
      <Label>I want to mint</Label>
      <Input value="800.00" />
      <Unit>LQTY</Unit>
    </Field>

    <Text>Balance: 278.10 → 1078.10 LQTY</Text>

    <Text>After changes:</Text>

    <Flex
      sx={{
        justifyContent: "space-around",
        width: "100%"
      }}
    >
      <IndicatorWidget>
        <Icon name="percent" />
        <IndicatorLabel>Collateral ratio</IndicatorLabel>
        <Text sx={{ color: "warning" }}>143.6%</Text>
      </IndicatorWidget>

      <IndicatorWidget>
        <Icon name="exclamation-circle" size="lg" />
        <IndicatorLabel>Liquidation price</IndicatorLabel>
        <Text>$123.43</Text>
      </IndicatorWidget>
    </Flex>
  </Form>
);
