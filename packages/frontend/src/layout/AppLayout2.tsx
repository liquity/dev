import React, { useState, useEffect } from "react";
import { Flex, IconButton, Box } from "theme-ui";
import { useResponsiveValue } from "@theme-ui/match-media";

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
import { Icon, InfoPaneIcon } from "../components/Icon";

const baseGap = [3, null, null, 5] as const;
const bannerHeight = ["56px", null, null, "72px"] as const;
const navBarWidth = "250px";
const complementaryWidth = "272px";
const transitionDuration = "0.33s";

export const AppLayout: React.FC = ({ children }) => {
  const [navBarOpen, setNavBarOpen] = useState(false);
  const [complementaryOpen, setComplementaryOpen] = useState(false);

  const closeNavBar = useResponsiveValue([false, null, null, true]);
  const closeComplementary = useResponsiveValue([false, null, true]);

  useEffect(() => {
    if (closeNavBar) {
      setNavBarOpen(false);
    }
  }, [closeNavBar]);

  useEffect(() => {
    if (closeComplementary) {
      setComplementaryOpen(false);
    }
  }, [closeComplementary]);

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
            height: "100%",
            p: baseGap,
            fontSize: ["32px", "38px"],
            transitionDuration
          }}
        >
          <Flex sx={{ alignItems: "center" }}>
            <IconButton
              variant="nav"
              sx={{
                ...breakOnWide({
                  opacity: [1, 0],
                  fontSize: [4, "0"],
                  mr: [3, "-26px"],
                  pointerEvents: ["auto", "none"]
                }),
                transitionDuration
              }}
              onClick={() => {
                setNavBarOpen(open => !open);
                setComplementaryOpen(false);
              }}
            >
              <Icon name="bars" />
            </IconButton>

            <AccessibleLiquityLogo />
          </Flex>

          <Flex sx={{ alignItems: "center" }}>
            <Box sx={{ position: "relative", height: "100%" }}>
              <Flex
                sx={{
                  justifyContent: "flex-end",

                  position: "absolute",
                  right: 0,
                  width: "450px",
                  height: "100%",
                  zIndex: -1,

                  mr: ["-300px", null, 0],
                  opacity: [0, null, 1],
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
              </Flex>
            </Box>

            <WalletDropdownButton
              sx={{
                px: [3, 4],
                py: 3,

                boxShadow: "none",
                bg: "primary",
                color: "white",
                fontWeight: "medium",
                borderRadius: 1
              }}
            />

            <IconButton
              variant="nav"
              sx={{
                opacity: [1, null, 0],
                fontSize: [4, null, "0"],
                ml: [4, null, "-36px"],
                pointerEvents: ["auto", null, "none"],
                transitionDuration
              }}
              onClick={() => {
                setComplementaryOpen(open => !open);
                setNavBarOpen(false);
              }}
            >
              <InfoPaneIcon />
            </IconButton>
          </Flex>
        </Banner>
      </Box>

      <Box
        sx={{
          position: "fixed",
          zIndex: 8,
          top: bannerHeight,
          bottom: 0,
          left: navBarOpen ? 0 : [`-${navBarWidth}`, null, null, 0],
          width: navBarWidth,
          transitionDuration,

          pl: "env(safe-area-inset-left)",

          bg: "muted",
          borderRight: 1,
          borderColor: "border"
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
              onClick={() => setNavBarOpen(false)}
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

          position: "relative",

          mt: bannerHeight,
          ml: [0, null, null, navBarWidth],

          transitionDuration
        }}
      >
        <Box
          sx={{
            position: "absolute",
            zIndex: 7,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,

            bg: "text",
            opacity: navBarOpen || complementaryOpen ? 0.25 : 0,
            pointerEvents: navBarOpen || complementaryOpen ? "auto" : "none",

            transitionDuration
          }}
          onClick={() => {
            setNavBarOpen(false);
            setComplementaryOpen(false);
          }}
        />

        <Flex
          sx={{
            flexGrow: 1,
            flexDirection: "column",

            minHeight: ["440px", "605px"],
            maxHeight: ["670px", "750px"],

            pl: ["env(safe-area-inset-left)", null, null, 0]
          }}
        >
          {title &&
            React.cloneElement(title, {
              sx: {
                mt: 5,
                mb: [-6, 0],
                mx: [6, 7],

                fontSize: ["38px", 6],
                fontWeight: "bold",
                fontFamily: "heading",
                textTransform: "unset",
                letterSpacing: "unset"
              }
            })}

          <Main sx={{ flexGrow: 1, justifyContent: "center", pt: 0 }}>{restOfChildren}</Main>
        </Flex>

        <Box
          sx={{
            position: ["fixed", null, "unset"],
            zIndex: [8, null, "unset"],
            top: bannerHeight,
            bottom: 0,
            right: complementaryOpen ? 0 : `-${complementaryWidth}`,
            width: complementaryWidth,
            overflow: "auto",

            pr: "env(safe-area-inset-right)",

            bg: "muted",
            borderLeft: 1,
            borderColor: "border",

            transitionDuration
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
