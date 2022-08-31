import { Decimal } from "@liquity/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Heading, Close } from "theme-ui";
import { Icon } from "../../../Icon";
import { DisabledEditableRow, EditableRow, StaticRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex, SwapPayload } from "../../context/transitions";

const tokenSymbol: Record<BLusdAmmTokenIndex, string> = {
  [BLusdAmmTokenIndex.BLUSD]: "bLUSD",
  [BLusdAmmTokenIndex.LUSD]: "LUSD"
};

const outputToken: Record<BLusdAmmTokenIndex, BLusdAmmTokenIndex> = {
  [BLusdAmmTokenIndex.BLUSD]: BLusdAmmTokenIndex.LUSD,
  [BLusdAmmTokenIndex.LUSD]: BLusdAmmTokenIndex.BLUSD
};

export const SwapPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    inputToken,
    lusdBalance,
    bLusdBalance,
    getExpectedSwapOutput
  } = useBondView();
  const inputAmountEditingState = useState<string>();
  const maxInputAmount =
    (inputToken === BLusdAmmTokenIndex.BLUSD ? bLusdBalance : lusdBalance) ?? Decimal.ZERO;
  const [inputAmount, setInputAmount] = useState<Decimal>(maxInputAmount);
  const [outputAmount, setOutputAmount] = useState<Decimal>(Decimal.ZERO);
  const [exchangeRate, setExchangeRate] = useState<Decimal>(Decimal.ZERO);

  const isProcessingTransaction = statuses.SWAP === "PENDING";

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", { inputAmount, minOutputAmount: Decimal.ZERO } as SwapPayload);
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      const expectedOutputAmount = await getExpectedSwapOutput(inputToken, inputAmount);
      if (cancelled) return;
      setOutputAmount(expectedOutputAmount);
      setExchangeRate(expectedOutputAmount.div(inputAmount));
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [inputToken, inputAmount, getExpectedSwapOutput]);

  return (
    <>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>Sell bLUSD</Flex>
        <Close
          onClick={handleDismiss}
          sx={{
            position: "absolute",
            right: "24px",
            top: "24px"
          }}
        />
      </Heading>

      <EditableRow
        label="Sell"
        inputId="swap-input-amount"
        amount={inputAmount.prettify(2)}
        unit={tokenSymbol[inputToken]}
        editingState={inputAmountEditingState}
        editedAmount={inputAmount.toString()}
        setEditedAmount={amount => setInputAmount(Decimal.min(maxInputAmount, Decimal.from(amount)))}
        maxAmount={maxInputAmount.toString()}
        maxedOut={inputAmount.eq(maxInputAmount)}
      />

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        <Icon name="arrow-down" size="lg" />
      </Flex>

      <DisabledEditableRow
        label="Buy"
        inputId="swap-output-amount"
        amount={outputAmount.prettify(2)}
        unit={tokenSymbol[outputToken[inputToken]]}
      />

      <StaticRow
        label="Exchange rate"
        inputId="swap-exchange-rate"
        amount={exchangeRate.prettify(4)}
        unit={`${tokenSymbol[inputToken]}:${tokenSymbol[outputToken[inputToken]]}`}
      />

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isProcessingTransaction}>
          Back
        </Button>

        <Button variant="primary" onClick={handleConfirmPressed} disabled={isProcessingTransaction}>
          {!isProcessingTransaction && <>Confirm</>}
          {isProcessingTransaction && <Spinner size="28px" sx={{ color: "white" }} />}
        </Button>
      </Flex>
    </>
  );
};
