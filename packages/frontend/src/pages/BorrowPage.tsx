import React from "react";
import { Flex, Box, Text, Label, Input, Button, IconButton } from "theme-ui";

import { displayOnMobile } from "../utils/breakpoints";
import { Icon } from "../components/Icon";

export const BorrowPage: React.FC = () => (
  <Flex
    as="form"
    sx={{
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: ["stretch", "center"],

      position: "relative",
      zIndex: 0,
      height: "100%",
      maxHeight: ["650px", "500px"],

      "::before": {
        ...displayOnMobile,
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
          <Text sx={{ fontSize: 3, fontWeight: "medium", color: "success" }}>202.0%</Text>
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
        <Input id="trove-debt" aria-describedby="trove-debt-unit" value="1000.00" disabled />
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
);
