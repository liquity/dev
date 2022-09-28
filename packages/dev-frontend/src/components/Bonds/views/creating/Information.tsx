/** @jsxImportSource theme-ui */
import React, { useRef } from "react";
import {
  Box,
  Button,
  Checkbox,
  Close,
  Flex,
  Heading,
  Label,
  Paragraph,
  Link,
  Image
} from "theme-ui";
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
        <Image src="./bonds/bond-info.png" sx={{ height: "200px" }} />
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
          LUSD bonds receive a boosted LUSD token (bLUSD) at a discount, in exchange for LUSD.
          Bonders can cancel their bond at any time to recover their deposited LUSD.
        </Paragraph>
        <Paragraph sx={{ mt: 3 }}>
          Please visit the&nbsp;
          <Link href="https://liquity.gitbook.io/chicken-bonds/" target="_blank">
            docs
          </Link>
          &nbsp;to understand how LUSD bonds work.
        </Paragraph>
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
        <Button onClick={handleUnderstandPressed}>Continue</Button>
      </Flex>
    </InformationContainer>
  );
};
