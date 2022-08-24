import React from "react";
import { Card, Box, Heading, Flex, Button, Spinner, Container } from "theme-ui";
import { Empty } from "./Empty";
import { BondList } from "./BondList";
import { useBondView } from "../../context/BondViewContext";
import { BONDS } from "../../lexicon";
import { InfoIcon } from "../../../InfoIcon";
import { LUSD_OVERRIDE_ADDRESS } from "@liquity/chicken-bonds/lusd/addresses";

export const Idle: React.FC = () => {
  const { dispatchEvent, bonds, isSynchronising, getLusdFromFaucet, lusdBalance } = useBondView();

  if (lusdBalance === undefined) return null;

  const hasBonds = bonds !== undefined && bonds.length > 0;

  const showLusdFaucet = LUSD_OVERRIDE_ADDRESS !== null && lusdBalance.eq(0);

  return (
    <>
      {showLusdFaucet && (
        <Flex variant="layout.actions" mt={4}>
          <Button variant="outline" onClick={() => getLusdFromFaucet()}>
            Get 10k LUSD
          </Button>
        </Flex>
      )}
      {(hasBonds || isSynchronising) && (
        <>
          <Flex variant="layout.actions" mt={4}>
            <Flex sx={{ alignItems: "center" }}>
              {isSynchronising && <>Fetching latest bond data...</>}
            </Flex>
            <Button
              variant="primary"
              onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}
              disabled={isSynchronising}
            >
              {!isSynchronising && <>Create another bond</>}
              {isSynchronising && <Spinner size="28px" sx={{ color: "white" }} />}
            </Button>
          </Flex>
          <BondList />
          {isSynchronising && <Container variant="disabledOverlay" />}
        </>
      )}
      {!hasBonds && !isSynchronising && (
        <Card>
          <Heading>
            <Flex>
              {BONDS.term}
              <InfoIcon
                placement="left"
                size="xs"
                tooltip={<Card variant="tooltip">{BONDS.description}</Card>}
              />
            </Flex>
          </Heading>
          <Box sx={{ p: [2, 3] }}>
            {!hasBonds && <Empty />}

            <Flex variant="layout.actions" mt={4}>
              <Button variant="primary" onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}>
                Create bond
              </Button>
            </Flex>
          </Box>
        </Card>
      )}
    </>
  );
};
