/** @jsxImportSource theme-ui */

import { Decimal, Percent } from "@liquity/lib-base";
import React, { useEffect, useRef, useState } from "react";
import { Flex, Button, Spinner, Heading, Close, Box, Label, Radio, Input, Link } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { Placeholder } from "../../../Placeholder";
import {
  DisabledEditableAmounts,
  DisabledEditableRow,
  EditableRow,
  StaticAmounts,
  StaticRow
} from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex } from "../../context/transitions";

const tokenSymbol: Record<BLusdAmmTokenIndex.BLUSD | BLusdAmmTokenIndex.LUSD, string> = {
  [BLusdAmmTokenIndex.BLUSD]: "bLUSD",
  [BLusdAmmTokenIndex.LUSD]: "LUSD"
};

const outputToken: Record<
  BLusdAmmTokenIndex.BLUSD | BLusdAmmTokenIndex.LUSD,
  BLusdAmmTokenIndex.BLUSD | BLusdAmmTokenIndex.LUSD
> = {
  [BLusdAmmTokenIndex.BLUSD]: BLusdAmmTokenIndex.LUSD,
  [BLusdAmmTokenIndex.LUSD]: BLusdAmmTokenIndex.BLUSD
};

const marginalAmount = Decimal.ONE.div(1000);

type SlippageTolerance = "half" | "one" | "custom";

const checkSlippageTolerance = (value: string): SlippageTolerance => {
  if (value === "half" || value === "one" || value === "custom") {
    return value;
  }

  throw new Error(`invalid slippage tolerance choice "${value}"`);
};

export const SwapPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    inputToken,
    lusdBalance,
    bLusdBalance,
    isInputTokenApprovedWithBLusdAmm,
    bLusdAmmBLusdBalance,
    bLusdAmmLusdBalance,
    getExpectedSwapOutput
  } = useBondView();
  const editingState = useState<string>();
  const inputTokenBalance =
    (inputToken === BLusdAmmTokenIndex.BLUSD ? bLusdBalance : lusdBalance) ?? Decimal.ZERO;
  const [inputAmount, setInputAmount] = useState<Decimal>(Decimal.ZERO);
  const [outputAmount, setOutputAmount] = useState<Decimal>();
  const [exchangeRate, setExchangeRate] = useState<Decimal>();
  const [priceImpact, setPriceImpact] = useState<Decimal>();
  const [slippageToleranceChoice, setSlippageToleranceChoice] = useState<SlippageTolerance>("half");
  const [customSlippageTolerance, setCustomSlippageTolerance] = useState<Decimal>();
  const [customSlippageToleranceFocus, setCustomSlippageToleranceFocus] = useState(false);
  const customSlippageToleranceRef = useRef<HTMLInputElement>(null);

  const priceImpactPct = priceImpact && new Percent(priceImpact);
  const isApprovePending = statuses.APPROVE_AMM === "PENDING";
  const isSwapPending = statuses.SWAP === "PENDING";
  const isBalanceInsufficient = inputAmount.gt(inputTokenBalance);
  const isSlippageToleranceInvalid =
    slippageToleranceChoice === "custom" &&
    (!customSlippageTolerance ||
      customSlippageTolerance.lt(0.001) ||
      customSlippageTolerance.gt(Decimal.ONE));
  const isSlippageToleranceHigh = customSlippageTolerance?.gt(0.05);

  // Used in dependency list of effect to recalculate output amount in case of pool changes
  const poolState = `${bLusdAmmBLusdBalance},${bLusdAmmLusdBalance}`;

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED");
  };

  const handleConfirmPressed = () => {
    if (!outputAmount) {
      return;
    }

    const slippageTolerance =
      slippageToleranceChoice === "half"
        ? Decimal.from(0.005)
        : slippageToleranceChoice === "one"
        ? Decimal.from(0.01)
        : customSlippageTolerance;

    if (!slippageTolerance || isSlippageToleranceInvalid) {
      return;
    }

    const minOutputFactor = Decimal.ONE.sub(slippageTolerance);

    dispatchEvent("CONFIRM_PRESSED", {
      inputAmount,
      minOutputAmount: outputAmount.mul(minOutputFactor)
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  const handleSlippageToleranceChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSlippageToleranceChoice(checkSlippageTolerance(e.target.value));

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      setOutputAmount(undefined);
      setExchangeRate(undefined);
      setPriceImpact(undefined);

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
  }, [inputToken, inputAmount, getExpectedSwapOutput, poolState]);

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

      <DisabledEditableRow label="Buy">
        {outputAmount ? (
          <DisabledEditableAmounts
            inputId="swap-output-amount"
            amount={outputAmount.prettify(2)}
            unit={tokenSymbol[outputToken[inputToken]]}
          />
        ) : (
          <DisabledEditableAmounts inputId="swap-output-amount">
            <Box sx={{ width: "160px", height: "20px", mt: "10px", mb: "6px" }}>
              <Placeholder />
            </Box>
          </DisabledEditableAmounts>
        )}
      </DisabledEditableRow>

      <StaticRow label="Exchange rate">
        {exchangeRate ? (
          <StaticAmounts
            inputId="swap-exchange-rate"
            amount={exchangeRate.prettify(4)}
            unit={`${tokenSymbol[inputToken]}:${tokenSymbol[outputToken[inputToken]]}`}
          />
        ) : (
          <StaticAmounts inputId="swap-exchange-rate">
            <Box sx={{ width: "180px", height: "16px", mt: "9px", mb: "5px" }}>
              <Placeholder />
            </Box>
          </StaticAmounts>
        )}
      </StaticRow>

      <StaticRow label="Price impact">
        {priceImpact && priceImpactPct ? (
          <StaticAmounts
            inputId="swap-price-impact"
            amount={priceImpactPct.toString(4)}
            color={priceImpact.gte(0.005) ? "danger" : undefined}
          />
        ) : (
          <StaticAmounts inputId="swap-price-impact">
            <Box sx={{ width: "80px", height: "16px", mt: "9px", mb: "5px" }}>
              <Placeholder />
            </Box>
          </StaticAmounts>
        )}
      </StaticRow>

      <details>
        <summary sx={{ cursor: "pointer", mx: 2, mb: 2 }}>Slippage tolerance</summary>

        <Flex sx={{ alignItems: "center", mx: 4, mb: 3 }}>
          <Label variant="radioLabel">
            <Radio
              name="swap-slippage-tolerance"
              value="half"
              checked={slippageToleranceChoice === "half"}
              onChange={handleSlippageToleranceChange}
            />
            0.5%
          </Label>

          <Label variant="radioLabel">
            <Radio
              name="swap-slippage-tolerance"
              value="one"
              checked={slippageToleranceChoice === "one"}
              onChange={handleSlippageToleranceChange}
            />
            1%
          </Label>

          <Label variant="radioLabel" sx={{ alignItems: "center" }}>
            <Radio
              name="swap-slippage-tolerance"
              value="custom"
              checked={slippageToleranceChoice === "custom"}
              onChange={handleSlippageToleranceChange}
            />
            <Input
              ref={customSlippageToleranceRef}
              sx={{
                py: "6px",
                px: "10px",
                width: "110px",
                fontSize: 2,
                ...(!customSlippageToleranceFocus
                  ? isSlippageToleranceInvalid
                    ? { bg: "invalid", borderColor: "danger" }
                    : isSlippageToleranceHigh
                    ? { borderColor: "warning" }
                    : {}
                  : {})
              }}
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="Custom"
              onFocus={() => {
                setSlippageToleranceChoice("custom");
                setCustomSlippageToleranceFocus(true);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  customSlippageToleranceRef.current?.blur();
                }
              }}
              onBlur={() => setCustomSlippageToleranceFocus(false)}
              onChange={e => {
                try {
                  setCustomSlippageTolerance(Decimal.from(e.target.value).div(100));
                } catch {
                  setCustomSlippageTolerance(undefined);
                }
              }}
            />
            &nbsp;%
          </Label>
        </Flex>
      </details>

      {isBalanceInsufficient && (
        <ErrorDescription>
          Amount exceeds your balance by{" "}
          <Amount>
            {inputAmount.sub(inputTokenBalance).prettify(2)} {tokenSymbol[inputToken]}
          </Amount>
        </ErrorDescription>
      )}

      {(bLusdAmmBLusdBalance?.isZero || bLusdAmmLusdBalance?.isZero) && (
        <ErrorDescription>No liquidity in pool yet. Swap unavailable.</ErrorDescription>
      )}

      <Flex pb={2} sx={{ fontSize: "15.5px", justifyContent: "center", fontStyle: "italic" }}>
        Your swap is performed directly in&nbsp;
        <Link href="https://curve.fi/factory-crypto/134" target="_blank">
          Curve
        </Link>
        &nbsp;protocol.
      </Flex>

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
            disabled={
              inputAmount.isZero ||
              !outputAmount ||
              isBalanceInsufficient ||
              isSlippageToleranceInvalid ||
              isSwapPending
            }
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
