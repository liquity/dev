import React from "react";
import { HashRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import {
  ThemeProvider,
  Box,
  Flex,
  Heading,
  Card,
  Text,
  Button,
  Label,
  Input,
  IconButton
} from "theme-ui";

import theme from "./theme";
import { Icon } from "./components/Icon";
import { Nav } from "./components/Nav";
import { NavLink } from "./components/NavLink";
import { AccessibleLiquityLogo } from "./components/AccessibleLiquityLogo";

const LiquityFrontend: React.FC = () => {
  return (
    <Flex
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%",

        backgroundImage: ["url(blob-collapsed.svg)", null, null, "url(blob.svg)"],
        backgroundRepeat: "no-repeat",
        backgroundPosition: "100% 0%"
      }}
    >
      <Flex
        as="header"
        variant="styles.backgroundGradient"
        sx={{
          position: "relative",
          zIndex: 1,

          p: [5, 7],
          fontSize: 6
        }}
      >
        <AccessibleLiquityLogo />

        <Heading
          variant="caps"
          sx={{
            flexGrow: 1,

            position: ["absolute", "unset"],
            top: "100%",

            ml: [0, "0.75em"],
            fontSize: "0.5em",
            lineHeight: 2.2
          }}
        >
          <Switch>
            <Route path="/borrow">My Trove</Route>
            <Route path="/grow">My Stability Deposit</Route>
            <Route path="/redeem">Redeem</Route>
          </Switch>
        </Heading>

        <Box
          sx={{
            display: ["none", null, null, "flex"],
            alignItems: "center",

            mr: 8,
            fontSize: 3,
            lineHeight: 1.1
          }}
        >
          <Icon name="wallet" size="lg" aria-label="Wallet balance" aria-hidden={false} />

          <Text sx={{ ml: 5, my: -5, fontSize: "0.9em", fontFamily: "heading", fontWeight: "body" }}>
            <div>10.4527 ETH</div>
            <div>278.10 LQTY</div>
          </Text>
        </Box>

        <Button
          variant="cardlike"
          sx={{
            display: ["none", null, null, "flex"],
            fontSize: 3
          }}
        >
          <Icon name="user-circle" />
          <Text sx={{ mx: 3 }}>0x70E...DDF</Text>
          <Icon name="caret-down" />
        </Button>

        <IconButton
          variant="cardlike"
          sx={{
            display: ["flex", null, null, "none"],

            position: "absolute",
            right: 4,
            top: 4,

            fontSize: 2
          }}
        >
          <Icon name="info" />
        </IconButton>
      </Flex>

      <Flex variant="styles.backgroundGradient" sx={{ flexGrow: 1 }}>
        <Flex sx={{ flexDirection: "column", zIndex: 1 }}>
          <Nav
            sx={{
              flexGrow: 1,

              position: ["absolute", "unset"],
              top: 5,
              left: 8,
              right: 8,

              px: "1.4em",
              lineHeight: [1.1, 1.8],

              ul: {
                display: "flex",
                flexDirection: ["row", "column"],
                justifyContent: "center",

                a: {
                  color: "text",
                  textDecoration: "none",
                  fontFamily: "heading",
                  fontSize: [1, 4],

                  "&.active": {
                    color: "primary"
                  },

                  "&:hover": {
                    color: "secondary"
                  }
                }
              }
            }}
          >
            <NavLink to="/borrow" icon="hands-helping">
              Borrow
            </NavLink>

            <NavLink to="/grow" icon="seedling">
              Grow
            </NavLink>

            <NavLink to="/redeem" icon="retweet">
              Redeem
            </NavLink>
          </Nav>

          <Box
            as="footer"
            sx={{
              display: ["none", "block"],
              p: 7,
              whiteSpace: "nowrap"
            }}
          >
            © Liquity.org | 2020
          </Box>
        </Flex>

        <Box sx={{ flexGrow: 1, minHeight: ["440px", "560px"] }}>
          <Flex
            sx={{
              alignItems: "center",
              justifyContent: "center",

              position: ["unset", "absolute"],
              top: 0,
              left: 0,
              width: "100%",
              height: "100%"
            }}
          >
            <Box
              as="main"
              sx={{
                height: ["100%", "470px"],
                width: ["100%", "500px"],
                mr: [0, null, null, "320px"],
                ml: [0, "220px", null, "320px"],
                p: 5
              }}
            >
              <Switch>
                <Route exact path="/">
                  <Redirect to="/borrow" />
                </Route>

                <Route path="/borrow">
                  <Flex
                    as="form"
                    sx={{
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: ["stretch", "center"],

                      position: "relative",
                      zIndex: 0,
                      height: "100%",

                      ":before": {
                        display: ["block", "none"],
                        content: '""'
                      }
                    }}
                  >
                    <Flex
                      sx={{
                        justifyContent: "center",
                        alignItems: "center",

                        position: "absolute",
                        zIndex: -1,
                        top: ["12%", 0],
                        width: "100%",
                        height: ["88%", "100%"],

                        color: "muted",
                        opacity: 0.5
                      }}
                    >
                      <Icon name="lock" size="10x" />
                    </Flex>

                    <Flex
                      sx={{
                        justifyContent: "space-around",
                        width: "100%",
                        fontSize: [0, 1]
                      }}
                    >
                      <Flex sx={{ alignItems: "center" }}>
                        <Icon name="percent" size="lg" />
                        <Box sx={{ ml: [3, 5] }}>
                          <Text>Collateral ratio</Text>
                          <Text sx={{ fontSize: 3, fontWeight: "medium", color: "success" }}>
                            202.0%
                          </Text>
                        </Box>
                      </Flex>

                      <Flex sx={{ alignItems: "center" }}>
                        <Icon name="exclamation-circle" size="2x" />
                        <Box sx={{ ml: [3, 5] }}>
                          <Text>Liquidation price</Text>
                          <Text sx={{ fontSize: 3, fontWeight: "medium" }}>$87.74</Text>
                        </Box>
                      </Flex>
                    </Flex>

                    <Box sx={{ position: "relative" }}>
                      <Label htmlFor="trove-collateral" sx={{ position: "absolute", top: "-1.5em" }}>
                        Collateral
                      </Label>

                      <Flex>
                        <Input
                          id="trove-collateral"
                          aria-describedby="trove-collateral-unit"
                          value="12.5390"
                          disabled
                        />
                        <Flex id="trove-collateral-unit" variant="forms.unit">
                          ETH
                          <IconButton aria-label="Change currency" sx={{ fontSize: 2 }}>
                            <Icon name="retweet" />
                          </IconButton>
                        </Flex>
                      </Flex>
                    </Box>

                    <Box sx={{ position: "relative" }}>
                      <Label htmlFor="trove-debt" sx={{ position: "absolute", top: "-1.5em" }}>
                        Outstanding debt
                      </Label>

                      <Flex>
                        <Input
                          id="trove-debt"
                          aria-describedby="trove-debt-unit"
                          value="1000.00"
                          disabled
                        />
                        <Box id="trove-debt-unit" variant="forms.unit">
                          LQTY
                        </Box>
                      </Flex>
                    </Box>

                    <Button>
                      <Icon name="unlock" />
                      Make changes
                    </Button>
                  </Flex>
                </Route>
              </Switch>
            </Box>
          </Flex>
        </Box>

        <Box as="aside" sx={{ display: ["none", null, null, "block"], zIndex: 1 }}>
          <Card>
            <Heading>Liquity System</Heading>

            <table>
              <tbody>
                {[
                  ["Total collateral ratio:", "311%"],
                  ["Total LQTY supply:", "7.48M"],
                  ["LQTY in Stability Pool:", "1.35M"],
                  ["% of LQTY in Stability Pool:", "18%"],
                  ["Number of Troves:", "3421"]
                ].map(([c1, c2], i) => (
                  <tr key={i}>
                    <td>{c1}</td>
                    <td style={{ textAlign: "right" }}>{c2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card sx={{ ml: 9 }}>
            <Heading>Price Feeds</Heading>

            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td>ETH:</td>
                  <td style={{ textAlign: "right" }}>$161.13</td>
                </tr>
                <tr>
                  <td>LQTY:</td>
                  <td style={{ textAlign: "right" }}>$1.01</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Box>
      </Flex>
    </Flex>
  );
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <LiquityFrontend />
      </Router>
    </ThemeProvider>
  );
};

export default App;
