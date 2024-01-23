import React, { useEffect, useState } from "react";
import { Card, Box, Heading, Flex, Button } from "theme-ui";
import { Empty } from "./Empty";
import { BondList } from "./BondList";
import { useBondView } from "../../context/BondViewContext";
import { BONDS } from "../../lexicon";
import { InfoIcon } from "../../../InfoIcon";
import { BLusdAmmTokenIndex, SwapPressedPayload } from "../../context/transitions";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { useBondAddresses } from "../../context/BondAddressesContext";

export const Idle: React.FC = () => {
  const { liquity } = useLiquity();
  const { LUSD_OVERRIDE_ADDRESS } = useBondAddresses();

  const { dispatchEvent, bonds, getLusdFromFaucet, lusdBalance, hasLoaded } = useBondView();
  const [chain, setChain] = useState<number>();

  useEffect(() => {
    (async () => {
      if (liquity.connection.signer === undefined || chain !== undefined) return;
      const chainId = await liquity.connection.signer.getChainId();
      setChain(chainId);
    })();
  }, [chain, liquity.connection.signer]);

  if (!hasLoaded) return null;

  const hasBonds = bonds !== undefined && bonds.length > 0;

  const showLusdFaucet = LUSD_OVERRIDE_ADDRESS !== null && lusdBalance?.eq(0);

  const handleManageLiquidityPressed = () => dispatchEvent("MANAGE_LIQUIDITY_PRESSED");

  const handleBuyBLusdPressed = () =>
    dispatchEvent("SWAP_PRESSED", { inputToken: BLusdAmmTokenIndex.LUSD } as SwapPressedPayload);

  const handleSellBLusdPressed = () =>
    dispatchEvent("SWAP_PRESSED", { inputToken: BLusdAmmTokenIndex.BLUSD } as SwapPressedPayload);

  return (
    <>
      <Flex variant="layout.actions" sx={{ mt: 4, mb: 3 }}>
        <Button variant="outline" onClick={handleManageLiquidityPressed}>
          Manage liquidity
        </Button>

        <Button variant="outline" onClick={handleBuyBLusdPressed}>
          Buy bLUSD
        </Button>

        <Button variant="outline" onClick={handleSellBLusdPressed}>
          Sell bLUSD
        </Button>

        {showLusdFaucet && (
          <Button variant={hasBonds ? "outline" : "primary"} onClick={() => getLusdFromFaucet()}>
            Get 10k LUSD
          </Button>
        )}

        {hasBonds && (
          <Button variant="primary" onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}>
            Create another bond
          </Button>
        )}
      </Flex>

      {!hasBonds && (
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
            <Empty />

            <Flex variant="layout.actions" mt={4}>
              <Button variant="primary" onClick={() => dispatchEvent("CREATE_BOND_PRESSED")}>
                Create bond
              </Button>
            </Flex>
          </Box>
        </Card>
      )}

      {hasBonds && <BondList />}
    </>
  );
};
