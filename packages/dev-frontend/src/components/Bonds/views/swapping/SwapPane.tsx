import { Decimal, Percent } from "@liquity/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Heading, Close } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { DisabledEditableRow, EditableRow, StaticRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex } from "../../context/transitions";

const tokenSymbol: Record<BLusdAmmTokenIndex, string> = {
  [BLusdAmmTokenIndex.BLUSD]: "bLUSD",
  [BLusdAmmTokenIndex.LUSD]: "LUSD"
};

const outputToken: Record<BLusdAmmTokenIndex, BLusdAmmTokenIndex> = {
  [BLusdAmmTokenIndex.BLUSD]: BLusdAmmTokenIndex.LUSD,
  [BLusdAmmTokenIndex.LUSD]: BLusdAmmTokenIndex.BLUSD
};

const marginalAmount = Decimal.ONE.div(1000);

export const SwapPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    inputToken,
    lusdBalance,
    bLusdBalance,
    isInputTokenApprovedWithBLusdAmm,
    getExpectedSwapOutput
  } = useBondView();
  const editingState = useState<string>();
  const inputTokenBalance =
    (inputToken === BLusdAmmTokenIndex.BLUSD ? bLusdBalance : lusdBalance) ?? Decimal.ZERO;
  const [inputAmount, setInputAmount] = useState<Decimal>(Decimal.ZERO);
  const [outputAmount, setOutputAmount] = useState<Decimal>(Decimal.ZERO);
  const [exchangeRate, setExchangeRate] = useState<Decimal>(Decimal.ZERO);
  const [priceImpact, setPriceImpact] = useState<Decimal>(Decimal.ZERO);
  const priceImpactPct = new Percent(priceImpact);

  const isApprovePending = statuses.APPROVE_AMM === "PENDING";
  const isSwapPending = statuses.SWAP === "PENDING";
  const isBalanceInsufficient = inputAmount.gt(inputTokenBalance);

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED");
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      inputAmount,
      minOutputAmount: outputAmount.mul(0.995) // 0.5% slippage tolerance
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const [marginalOutput, outputAmount] = await Promise.all([
          getExpectedSwapOutput(inputToken, marginalAmount),
          inputAmount.nonZero && getExpectedSwapOutput(inputToken, inputAmount)
        ]);

        if (cancelled) return;

        const marginalExchangeRate = marginalOutput.div(marginalAmount);
        const exchangeRate = outputAmount?.div(inputAmount);
        const priceImpact = exchangeRate?.lte(marginalExchangeRate)
          ? marginalExchangeRate.sub(exchangeRate).div(marginalExchangeRate)
          : Decimal.ZERO;

        setOutputAmount(outputAmount ?? Decimal.ZERO);
        setExchangeRate(exchangeRate ?? marginalExchangeRate);
        setPriceImpact(priceImpact);
      } catch (error) {
        console.error("getExpectedSwapOutput() failed");
        console.log(error);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [inputToken, inputAmount, getExpectedSwapOutput]);

  return (
    <>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>
          {inputToken === BLusdAmmTokenIndex.BLUSD ? <>Sell</> : <>Buy</>} bLUSD
        </Flex>
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
        editingState={editingState}
        editedAmount={inputAmount.toString()}
        setEditedAmount={amount => setInputAmount(Decimal.from(amount))}
        maxAmount={inputTokenBalance.toString()}
        maxedOut={inputAmount.eq(inputTokenBalance)}
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

      <StaticRow
        label="Price impact"
        inputId="swap-price-impact"
        amount={priceImpactPct.toString(4)}
        color={priceImpact.gte(0.005) ? "danger" : undefined}
      />

      {isBalanceInsufficient && (
        <ErrorDescription>
          Amount exceeds your balance by{" "}
          <Amount>
            {inputAmount.sub(inputTokenBalance).prettify(2)} {tokenSymbol[inputToken]}
          </Amount>
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={handleBackPressed}
          disabled={isApprovePending || isSwapPending}
        >
          Back
        </Button>

        {isInputTokenApprovedWithBLusdAmm ? (
          <Button
            variant="primary"
            onClick={handleConfirmPressed}
            disabled={inputAmount.isZero || isBalanceInsufficient || isSwapPending}
          >
            {isSwapPending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Confirm</>}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleApprovePressed} disabled={isApprovePending}>
            {isApprovePending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Approve</>}
          </Button>
        )}
      </Flex>
    </>
  );
};
