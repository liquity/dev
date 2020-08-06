import React from "react";
import { Flex, Box } from "theme-ui";

import { partition, isElement } from "../utils/children";
import {
  displayOnNonMobile,
  breakOnWide,
  displayOnWide,
  displayOnNonWide
} from "../utils/breakpoints";
import { Banner } from "../components/Banner";
import { AccessibleLiquityLogo } from "../components/AccessibleLiquityLogo";
import { Title } from "../components/Title";
import { Nav } from "../components/Nav";
import { AppNavBar } from "../components/AppNavBar";
import { ContentInfo } from "../components/ContentInfo";
import { Main } from "../components/Main";
import { Complementary } from "../components/Complementary";
import { MoreInfoButton } from "../components/MoreInfoButton";
import { WalletDropdownButton } from "../components/WalletDropdownButton";
import { WalletBalanceWidget } from "../components/WalletBalanceWidget";
import { SystemStatsCard } from "../components/SystemStatsCard";
import { PriceFeedsCard } from "../components/PriceFeedsCard";

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
      variant="styles.appBackground"
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%"
      }}
    >
      <Banner sx={{ position: "relative", p: [5, 7] }}>
        <AccessibleLiquityLogo />

        {title &&
          React.cloneElement(title, {
            sx: {
              position: ["absolute", "unset"],
              top: "100%",
              ml: [0, "0.75em"],
              mt: "0.6em",
              fontSize: "0.5em"
            }
          })}
      </Banner>

      <Flex sx={{ flexGrow: 1 }}>
        <Flex sx={{ flexDirection: "column" }}>
          {nav && (
            <AppNavBar
              sx={{
                flexGrow: 1,

                position: ["absolute", "unset"],
                top: 5,
                left: 8,
                right: 8,

                mx: 7,

                ...nav.props.sx
              }}
            >
              {nav.props.children}
            </AppNavBar>
          )}

          <ContentInfo sx={{ ...displayOnNonMobile }}>© Liquity.org | 2020</ContentInfo>
        </Flex>

        <Box sx={{ flexGrow: 1, minHeight: ["440px", "605px"], maxHeight: ["650px", "unset"] }}>
          <Main
            sx={{
              position: ["unset", "absolute"],
              top: 0,
              left: [null, "220px", null, "320px"],
              right: [null, 0, null, "320px"],
              height: "100%"
            }}
          >
            {restOfChildren}
          </Main>
        </Box>

        <Box
          sx={{
            position: "absolute",

            ...breakOnWide({
              right: [4, 7],
              top: [4, 7]
            })
          }}
        >
          <Complementary sx={{ ...displayOnNonWide }}>
            <MoreInfoButton />
          </Complementary>

          <Complementary sx={{ ...displayOnWide }}>
            <Flex
              sx={{
                flexDirection: "row-reverse",
                justifyContent: "space-between",
                width: "360px"
              }}
            >
              <WalletDropdownButton />
              <WalletBalanceWidget />
            </Flex>

            <Box sx={{ position: "absolute", right: 0 }}>
              <SystemStatsCard sx={{ mt: 8 }} />
              <PriceFeedsCard sx={{ mt: 8, ml: 7 }} />
            </Box>
          </Complementary>
        </Box>
      </Flex>
    </Flex>
  );
};
