import React from "react";
import { Input, Text, Flex, IconButton, Button, Box, Checkbox, Link as ThemeUILink } from "theme-ui";
import { Link, useRouteMatch, Route } from "react-router-dom";

import { useDialogBasePage, ButtonLink, NestedSwitch } from "../utils/routing";
import { Form } from "../components/Form";
import { Title } from "../components/Title";
import { Field, Label, Unit } from "../components/Field";
import { IndicatorLabel, IndicatorWidget } from "../components/IndicatorWidget";
import { Icon } from "../components/Icon";
import { Nav } from "../components/Nav";
import { DialogLayout } from "../layout/DialogLayout";

type DialogPageProps = {
  backTo: string;
  continueTo: string;
};

const ModifyPage: React.FC<DialogPageProps> = ({ backTo, continueTo }) => {
  return (
    <DialogLayout>
      <Title>Change my Trove</Title>

      <Nav>
        <Link to={backTo}>
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

        <ButtonLink to={continueTo}>
          <Button>Continue</Button>
        </ButtonLink>
      </Form>
    </DialogLayout>
  );
};

const ReviewPage: React.FC<DialogPageProps> = ({ backTo, continueTo }) => {
  return (
    <DialogLayout>
      <Title>Review changes</Title>

      <Nav>
        <Link to={backTo}>
          <IconButton>
            <Icon name="arrow-left" aria-label="Go back" aria-hidden={false} />
          </IconButton>
        </Link>
      </Nav>

      <Flex
        sx={{
          flexGrow: 1,
          flexDirection: "column",
          alignItems: ["stretch", "center"],
          justifyContent: "space-between",
          maxWidth: ["unset", "500px"]
        }}
      >
        <Box
          sx={{
            mt: 4,
            width: "100%",

            table: {
              borderCollapse: "collapse",
              width: "100%",

              td: {
                p: 0,
                pt: 6,

                ":nth-child(1)": {
                  pr: 3,
                  fontSize: [1, 2]
                },

                ":nth-child(2)": {
                  pl: 3,
                  fontSize: ["12px", 2],
                  opacity: 0.55
                },

                "& > :nth-child(1)": {
                  letterSpacing: ["-0.04em", "unset"]
                },

                "& > :nth-child(2)": {
                  fontWeight: "medium"
                }
              }
            }
          }}
        >
          <table>
            <tbody>
              {[
                ["I add collateral", "3.500 ETH", "My new collateral", "16.039 ETH"],
                ["I mint", "800.00 LQTY", "My new debt", "1800.00 LQTY"],
                ["My new collateral ratio", "143.6%", "Total collateral ratio", "311%"],
                ["My new liquidation price", "$123.43", "Current price of ETH", "161.13$"]
              ].map(([leftLabel, leftText, rightLabel, rightText], i) => (
                <tr key={i}>
                  <td>
                    <div>{leftLabel}</div>
                    <div>{leftText}</div>
                  </td>
                  <td>
                    <div>{rightLabel}</div>
                    <div>{rightText}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>

        <Flex sx={{ flexDirection: "column", alignItems: ["stretch", "center"] }}>
          <Box
            sx={{
              mb: 5,
              mt: [0, 7],
              fontSize: ["10.5px", 1],
              letterSpacing: ["-0.04em", "unset"],
              color: "danger"
            }}
          >
            <Flex sx={{ mb: 3, alignItems: "center" }}>
              <Checkbox sx={{ color: "danger" }} />
              <Label sx={{ textAlign: "justify" }}>
                I understand that my collateral ratio must remain above 110%, otherwise my Trove can
                be liquidated
              </Label>
            </Flex>

            <Flex sx={{ mb: 3, alignItems: "center" }}>
              <Checkbox sx={{ color: "danger" }} />
              <Label sx={{ textAlign: "justify" }}>
                I understand that my Trove could be liquidated even above 110% collateral ratio
                during Recovery Mode
              </Label>
            </Flex>

            <ThemeUILink href="#" sx={{ ml: 7, svg: { ml: 1 } }}>
              Learn more
              <Icon name="external-link-alt" size="sm" />
            </ThemeUILink>
          </Box>

          <ButtonLink to={continueTo}>
            <Button disabled>Confirm</Button>
          </ButtonLink>
        </Flex>
      </Flex>
    </DialogLayout>
  );
};

export const ChangeTroveDialog: React.FC = () => {
  const basePage = useDialogBasePage();
  const { url } = useRouteMatch();

  return (
    <NestedSwitch>
      <Route exact path="">
        <ModifyPage backTo={basePage} continueTo={`${url}/confirm`} />
      </Route>

      <Route path="confirm">
        <ReviewPage backTo={url} continueTo={basePage} />
      </Route>
    </NestedSwitch>
  );
};
