import React, { useState } from "react";
import { Flex, IconButton, Box } from "theme-ui";

import { partition, isElement } from "../utils/children";
import { breakOnWide } from "../utils/breakpoints";
import { Banner } from "../components/Banner";
import { AccessibleLiquityLogo } from "../components/AccessibleLiquityLogo2";
import { Title } from "../components/Title";
import { Nav } from "../components/Nav";
import { AppNavBar } from "../components/AppNavBar2";
import { ContentInfo } from "../components/ContentInfo";
import { Main } from "../components/Main";
import { Complementary } from "../components/Complementary";
import { WalletDropdownButton } from "../components/WalletDropdownButton";
import { SystemStatsCard } from "../components/SystemStatsCard2";
import { PriceFeedsCard } from "../components/PriceFeedsCard2";
import { WalletBalanceWidget } from "../components/WalletBalanceWidget2";
import { Icon } from "../components/Icon";

const baseGap = [3, null, null, 5] as const;
const bannerHeight = ["56px", null, null, "72px"] as const;
const navBarWidth = "250px";
const transitionDuration = "0.33s";

export const AppLayout: React.FC = ({ children }) => {
  const [sideBarOpen, setSideBarOpen] = useState(false);

  const arrayOfChildren = React.Children.toArray(children);
  const [[title, ...extraTitles], tmpChildren] = partition(arrayOfChildren, isElement(Title));
  const [[nav, ...extraNavs], restOfChildren] = partition(tmpChildren, isElement(Nav));

  if (extraTitles.length > 0) {
    throw new Error("<AppLayout> mustn't have more than one <Title>");
  }

  if (extraNavs.length > 0) {
    throw new Error("<AppLayout> mustn't have more than one <Nav>");
  }

  return (
    <Flex
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%",

        bg: "background"
      }}
    >
      <Box
        sx={{
          position: "fixed",
          zIndex: 9,
          top: 0,
          left: 0,
          right: 0,
          height: bannerHeight,

          pt: "env(safe-area-inset-top)",
          pl: "env(safe-area-inset-left)",
          pr: "env(safe-area-inset-right)",

          bg: "background",
          borderBottom: 1,
          borderBottomColor: "border",
          boxShadow: 2
        }}
      >
        <Banner
          sx={{
            justifyContent: "space-between",
            p: baseGap
          }}
        >
          <Flex sx={{ alignItems: "center" }}>
            <IconButton
              variant="nav"
              sx={{
                ...breakOnWide({ opacity: [1, 0], fontSize: [4, "0"] }),
                transitionDuration
              }}
              onClick={() => setSideBarOpen(open => !open)}
            >
              <Icon name="bars" />
            </IconButton>

            <AccessibleLiquityLogo
              sx={{ ...breakOnWide({ ml: [3, "-26px"] }), transitionDuration }}
            />
          </Flex>

          <Flex>
            <Box
              sx={{
                mr: ["-250px", null, 0],
                opacity: [0, null, 1],
                zIndex: -1,
                transitionDuration
              }}
            >
              <WalletBalanceWidget
                sx={{
                  mx: [5, null, null, 7],
                  px: 5,
                  height: "100%",

                  bg: "muted",
                  border: 1,
                  borderColor: "border",
                  borderRadius: 1
                }}
              />
            </Box>

            <WalletDropdownButton
              sx={{
                boxShadow: "none",
                bg: "primary",
                color: "white",
                fontWeight: "medium",
                borderRadius: 1
              }}
            />
          </Flex>
        </Banner>
      </Box>

      <Box
        sx={{
          position: "fixed",
          zIndex: 8,
          top: bannerHeight,
          bottom: 0,
          left: sideBarOpen ? 0 : [`-${navBarWidth}`, null, null, 0],
          width: navBarWidth,
          transitionDuration,

          pl: "env(safe-area-inset-left)",

          bg: "muted",
          borderRight: 1,
          borderColor: "border",
          boxShadow: [sideBarOpen ? 2 : "none", null, null, "none"]
        }}
      >
        <Flex
          sx={{
            flexDirection: "column",
            height: "100%",
            p: baseGap
          }}
        >
          {nav && (
            <AppNavBar
              onClick={() => setSideBarOpen(false)}
              sx={{
                flexGrow: 1,
                mr: [0, null, null, -baseGap[3]],

                ...nav.props.sx
              }}
            >
              {nav.props.children}
            </AppNavBar>
          )}

          <ContentInfo sx={{ p: 5 }}>© Liquity.org | 2020</ContentInfo>
        </Flex>
      </Box>

      <Flex
        sx={{
          flexGrow: 1,

          mt: bannerHeight,
          ml: [0, null, null, navBarWidth],

          transitionDuration
        }}
      >
        <Flex sx={{ flexGrow: 1, flexDirection: "column", minHeight: ["440px", "605px"] }}>
          {title &&
            React.cloneElement(title, {
              sx: {
                ml: 9,
                mt: 7,
                fontSize: 6,
                fontWeight: "bold",
                fontFamily: "heading",
                textTransform: "unset",
                letterSpacing: "unset"
              }
            })}

          <Main sx={{ flexGrow: 1, justifyContent: "center", mb: 8 }}>{restOfChildren}</Main>
        </Flex>

        <Box
          sx={{
            display: ["none", null, "block"],

            pr: "env(safe-area-inset-right)",

            bg: "muted",
            borderLeft: 1,
            borderColor: "border"
          }}
        >
          <Complementary
            sx={{
              px: baseGap,
              pb: baseGap
            }}
          >
            <SystemStatsCard sx={{ mt: baseGap }} />
            <PriceFeedsCard sx={{ mt: baseGap }} />
          </Complementary>
        </Box>
      </Flex>
    </Flex>
  );
};
