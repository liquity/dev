import React from "react";
import { Input, Text, Flex, IconButton, Button, Box } from "theme-ui";
import { Link } from "react-router-dom";

import { useDialogBasePage, RelativeLink } from "../utils/routing";
import { Form } from "../components/Form";
import { Title } from "../components/Title";
import { Field, Label, Unit } from "../components/Field";
import { IndicatorLabel, IndicatorWidget } from "../components/IndicatorWidget";
import { Icon } from "../components/Icon";
import { Nav } from "../components/Nav";
import { DialogLayout } from "../layout/DialogLayout";

export const ChangeTroveDialog: React.FC = () => {
  const basePage = useDialogBasePage();

  return (
    <DialogLayout>
      <Title>Change my Trove</Title>

      <Nav>
        <Link to={`/${basePage ?? ""}`}>
          <IconButton>
            <Icon name="times" aria-label="Close dialog" aria-hidden={false} />
          </IconButton>
        </Link>
      </Nav>

      <Form sx={{ maxHeight: ["800px", "520px"] }}>
        <Box>
          <Field id="change-trove-collateral">
            <Label>
              I want to
              <IconButton variant="inline">
                top-up
                <Icon name="retweet" size="xs" />
              </IconButton>
            </Label>
            <Input value="3.500" />
            <Unit>
              ETH
              <IconButton aria-label="Change currency">
                <Icon name="retweet" size="xs" />
              </IconButton>
            </Unit>
          </Field>

          <Text sx={{ ml: 1, opacity: 0.55 }}>Balance: 10.45 → 6.95 ETH</Text>
        </Box>

        <Box>
          <Field id="change-trove-debt">
            <Label>
              I want to
              <IconButton variant="inline">
                mint
                <Icon name="retweet" size="xs" />
              </IconButton>
            </Label>
            <Input value="800.00" />
            <Unit>LQTY</Unit>
          </Field>

          <Text sx={{ ml: 1, opacity: 0.55 }}>Balance: 278.10 → 1078.10 LQTY</Text>
        </Box>

        <Text sx={{ fontSize: 3 }}>After changes:</Text>

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

        <RelativeLink to="confirm">
          <Button>Continue</Button>
        </RelativeLink>
      </Form>
    </DialogLayout>
  );
};
