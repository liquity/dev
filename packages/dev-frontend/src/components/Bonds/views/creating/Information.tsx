/** @jsxImportSource theme-ui */
import React, { useRef } from "react";
import { Box, Button, Checkbox, Close, Flex, Heading, Label, Paragraph, Link } from "theme-ui";
import { Icon } from "../../../Icon";
import { useWizard } from "../../../Wizard/Context";
import { useBondView } from "../../context/BondViewContext";
import { Details } from "./Details";

const InformationContainer: React.FC = ({ children }) => {
  const { dispatchEvent } = useBondView();
  const handleDismiss = () => dispatchEvent("ABORT_PRESSED");

  return (
    <>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>Bond LUSD</Flex>
        <Close
          onClick={handleDismiss}
          sx={{
            position: "absolute",
            right: "24px",
            top: "24px"
          }}
        />
      </Heading>

      <Flex sx={{ justifyContent: "center" }}>
        <Icon name="question-circle" size="6x" />
      </Flex>

      {children}
    </>
  );
};

export const Information: React.FC = () => {
  const hideMessageRef = useRef<HTMLInputElement>(null);

  const { go, back } = useWizard();

  const handleUnderstandPressed = () => {
    if (hideMessageRef?.current?.checked) {
      window.localStorage.setItem("LIQUITY.BOND_FAQ.VISISBLE", "true");
    }
    go && go(Details);
  };

  return (
    <InformationContainer>
      <Box sx={{ p: [2, 3] }}>
        <Paragraph sx={{ mt: 2 }}>
          Deposit LUSD to create a bond which exchanges LUSD to bLUSD over time.
        </Paragraph>
        {/* <Paragraph sx={{ mt: 2 }}>
          bLUSD is a derivative of LUSD which is fully-backed by LUSD and redeemable, but has a
          higher yield than LUSD.
        </Paragraph> */}
        <Paragraph sx={{ mt: 2 }}>
          Bonds can be cancelled at any time to fully recover the initially deposited LUSD.
        </Paragraph>
        <Paragraph sx={{ mt: 2 }}>
          Please take some time to understand how LUSD bonds work:
        </Paragraph>

        <ul>
          <li>
            <Link sx={{ cursor: "pointer" }} href="http://google.com" target="external">
              What is a principal-protected investment?
            </Link>
          </li>
          <li>
            <Link sx={{ cursor: "pointer" }} href="http://google.com" target="external">
              How do traditional bonds work?
            </Link>
          </li>
          <li>
            <Link sx={{ cursor: "pointer" }} href="http://google.com" target="external">
              How do existing DeFi bonds work?
            </Link>
          </li>
          <li>
            <Link sx={{ cursor: "pointer" }} href="http://google.com" target="external">
              How do LUSD bonds work?
            </Link>
          </li>
          <li>
            <Link sx={{ cursor: "pointer" }} href="http://google.com" target="external">
              What is the LUSD bonding process?
            </Link>
          </li>
        </ul>
      </Box>

      <Flex variant="layout.actions">
        <Flex sx={{ justifyContent: "flex-end", flexDirection: "column" }}>
          <Label sx={{ fontSize: "14px" }}>
            <Flex>
              <Checkbox ref={hideMessageRef} />
              Don't show this message again
            </Flex>
          </Label>
        </Flex>
        <Button variant="cancel" onClick={back ? back : () => {}}>
          Back
        </Button>
        <Button onClick={handleUnderstandPressed}>I understand</Button>
      </Flex>
    </InformationContainer>
  );
};
