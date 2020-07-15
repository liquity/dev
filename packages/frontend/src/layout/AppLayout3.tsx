import React from "react";
import { Flex, Box } from "theme-ui";

import { partition, isElement } from "../utils/children";
import { displayOnNonMobile, displayOnWide, displayOnNonWide } from "../utils/breakpoints";
import { Banner } from "../components/Banner";
import { AccessibleLiquityLogo } from "../components/AccessibleLiquityLogo";
import { Title } from "../components/Title";
import { Nav } from "../components/Nav";
import { AppNavBar } from "../components/AppNavBar2";
import { ContentInfo } from "../components/ContentInfo";
import { Main } from "../components/Main";
import { Complementary } from "../components/Complementary";
import { MoreInfoButton } from "../components/MoreInfoButton";
import { WalletDropdownButton } from "../components/WalletDropdownButton";
import { SystemStatsCard } from "../components/SystemStatsCard2";
import { PriceFeedsCard } from "../components/PriceFeedsCard2";
import { WalletBalanceWidget } from "../components/WalletBalanceWidget2";

export const AppLayout: React.FC = ({ children }) => {
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
      <Banner
        sx={{
          justifyContent: "space-between",
          position: "relative",
          px: 9,
          py: 5,
          borderBottom: 1,
          borderBottomColor: "border",
          boxShadow: 1
        }}
      >
        <AccessibleLiquityLogo />

        <Flex>
          <WalletBalanceWidget
            sx={{ border: 1, borderColor: "border", borderRadius: 1, bg: "muted", px: 5 }}
          />

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

      <Flex sx={{ flexGrow: 1 }}>
        <Flex
          sx={{
            flexDirection: "column",
            pt: 6,
            bg: "muted",
            borderRight: 1,
            borderRightColor: "border"
          }}
        >
          {nav && (
            <AppNavBar
              sx={{
                flexGrow: 1,

                position: ["absolute", "unset"],
                top: 5,
                left: 8,
                right: 8,

                ...nav.props.sx
              }}
            >
              {nav.props.children}
            </AppNavBar>
          )}

          <ContentInfo sx={{ ...displayOnNonMobile, textAlign: "center" }}>
            © Liquity.org | 2020
          </ContentInfo>
        </Flex>

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

        <Box sx={{ pr: 8, pl: 5, bg: "muted" }}>
          <Complementary sx={{ ...displayOnNonWide }}>
            <MoreInfoButton />
          </Complementary>

          <Complementary sx={{ ...displayOnWide }}>
            <SystemStatsCard sx={{ mt: 5 }} />
            <PriceFeedsCard sx={{ mt: 5 }} />
          </Complementary>
        </Box>
      </Flex>
    </Flex>
  );
};
