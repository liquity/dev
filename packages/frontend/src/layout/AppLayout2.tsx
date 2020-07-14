import React from "react";
import { Flex, Box } from "theme-ui";

import { partition, isElement } from "../utils/children";
import { displayOnNonMobile, displayOnWide, displayOnNonWide } from "../utils/breakpoints";
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
import { SystemStatsCard } from "../components/SystemStatsCard";
import { PriceFeedsCard } from "../components/PriceFeedsCard";
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
          p: 5,
          pl: "56px",
          pr: 7,
          background:
            "linear-gradient(55deg, white 40%, rgba(139, 198, 236, 0.66) 80%, rgb(160, 172, 244, 1))",
          // boxShadow: 3,
          borderBottom: 1,
          borderBottomColor: "border"
        }}
      >
        <AccessibleLiquityLogo />

        <Flex>
          <WalletBalanceWidget />
          <WalletDropdownButton sx={{ boxShadow: "none" }} />
        </Flex>
      </Banner>

      <Flex sx={{ flexGrow: 1 }}>
        <Flex
          sx={{
            flexDirection: "column",
            // bg: "#ebecf0",
            bg: "muted",
            pt: 6,
            px: 6,
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

                mx: 7,

                ...nav.props.sx
              }}
            >
              {nav.props.children}
            </AppNavBar>
          )}

          <ContentInfo sx={{ ...displayOnNonMobile }}>© Liquity.org | 2020</ContentInfo>
        </Flex>

        <Flex sx={{ flexGrow: 1, flexDirection: "column", minHeight: ["440px", "605px"] }}>
          {title &&
            React.cloneElement(title, {
              sx: {
                pl: 6,
                fontSize: 4,
                fontWeight: "bold",
                fontFamily: "heading",
                textTransform: "none",
                lineHeight: 2,
                //background: "linear-gradient(90deg, #eaebed, white)",
                // bg: "#dfe2e8"
                // background: "linear-gradient(90deg, #dfe2e8, white)"
                // background: "linear-gradient(90deg, #f0f1f2, white 35%)"
                // background: "linear-gradient(90deg, rgb(160, 172, 244, 0.3), white 35%)"
                background: "linear-gradient(90deg, rgb(23, 74, 211, 0.1), white 35%)"
              }
            })}

          <Main sx={{ flexGrow: 1, justifyContent: "center", mb: 8 }}>{restOfChildren}</Main>
        </Flex>

        <Box
          sx={{
            // background: "linear-gradient(180deg, rgba(139, 198, 236, 0.3), rgb(157, 133, 247, 0.3))",
            // background: "linear-gradient(90deg, rgba(184, 220, 244, 0.5), rgb(196, 196, 249, 0.66))",
            // bg: "rgba(139, 198, 236, 0.3)",
            //bg: "rgba(184, 220, 244, 0.5)",
            pr: 7
          }}
        >
          <Complementary sx={{ ...displayOnNonWide }}>
            <MoreInfoButton />
          </Complementary>

          <Complementary sx={{ ...displayOnWide }}>
            <SystemStatsCard
              sx={{
                mt: 7,
                bg: "muted",
                boxShadow: "none",
                border: 1,
                borderColor: "border",
                h2: { fontSize: 3 },
                table: { fontSize: 2 }
              }}
            />
            <PriceFeedsCard
              sx={{
                mt: 7,
                bg: "muted",
                boxShadow: "none",
                border: 1,
                borderColor: "border",
                h2: { fontSize: 3 },
                table: { fontSize: 2 }
              }}
            />
          </Complementary>
        </Box>
      </Flex>
    </Flex>
  );
};
