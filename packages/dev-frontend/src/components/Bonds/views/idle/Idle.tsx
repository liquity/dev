import React from "react";
import { Card, Box, Heading, Flex, Button, Spinner, Container } from "theme-ui";
import { Empty } from "./Empty";
import { Bonds } from "./Bonds";
import { useBondView } from "../../context/BondViewContext";
import { BONDS } from "../../lexicon";
import { InfoIcon } from "../../../InfoIcon";

export const Idle: React.FC = () => {
  const { dispatchEvent, bonds, isSynchronising } = useBondView();
  const hasBonds = bonds !== undefined && bonds.length > 0;

  return (
    <>
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
          <Bonds />
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
