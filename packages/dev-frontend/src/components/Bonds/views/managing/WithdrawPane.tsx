import { Decimal } from "@liquity/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner, Label, Radio, Text } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { DisabledEditableRow, EditableRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex } from "../../context/transitions";

const tokenSymbol: Record<BLusdAmmTokenIndex, string> = {
  [BLusdAmmTokenIndex.BLUSD]: "bLUSD",
  [BLusdAmmTokenIndex.LUSD]: "LUSD"
};

const WithdrawnAmount: React.FC<{ symbol: string }> = ({ symbol, children }) => (
  <>
    <Text sx={{ fontWeight: "medium" }}>{children}</Text>
    &nbsp;
    <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{symbol}</Text>
  </>
);

export const WithdrawPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    inputToken,
    lusdBalance,
    bLusdBalance,
    getExpectedSwapOutput
  } = useBondView();

  const inputAmountEditingState = useState<string>();
  const inputTokenBalance =
    (inputToken === BLusdAmmTokenIndex.BLUSD ? bLusdBalance : lusdBalance) ?? Decimal.ZERO;
  const [burnLP, setInputAmount] = useState<Decimal>(inputTokenBalance);
  const [outputAmount, setOutputAmount] = useState<Decimal>(Decimal.ZERO);
  const [exchangeRate, setExchangeRate] = useState<Decimal>(Decimal.ZERO);

  const isApprovePending = statuses.APPROVE_AMM === "PENDING";
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBalanceInsufficient = burnLP.gt(inputTokenBalance);

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", { inputAmount: burnLP, minOutputAmount: Decimal.ZERO });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  useEffect(() => {
    if (burnLP.isZero) {
      setOutputAmount(Decimal.ZERO);
      setExchangeRate(Decimal.ZERO);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const expectedOutputAmount = await getExpectedSwapOutput(inputToken, burnLP);
        if (cancelled) return;
        setOutputAmount(expectedOutputAmount);
        setExchangeRate(expectedOutputAmount.div(burnLP));
      } catch (error) {
        console.error("getExpectedSwapOutput() failed");
        console.log(error);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [inputToken, burnLP, getExpectedSwapOutput]);

  return (
    <>
      <EditableRow
        label="Burn LP Tokens"
        inputId="withdraw-burn-lp"
        amount={burnLP.prettify(2)}
        editingState={inputAmountEditingState}
        editedAmount={burnLP.toString()}
        setEditedAmount={amount => setInputAmount(Decimal.from(amount))}
        maxAmount={inputTokenBalance.toString()}
        maxedOut={burnLP.eq(inputTokenBalance)}
      />

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        <Icon name="arrow-down" size="lg" />
      </Flex>

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        {Object.entries(tokenSymbol).map(([key, symbol]) => (
          <Label key={key} variant="radioLabel">
            <Radio name="withdraw-output-choice" value={key} />
            {symbol}
          </Label>
        ))}

        <Label key="both" variant="radioLabel">
          <Radio name="withdraw-output-choice" value="both" />
          Both
        </Label>
      </Flex>

      <DisabledEditableRow label="Withdraw" inputId="withdraw-output-amount">
        <Flex sx={{ alignItems: "center" }}>
          {[Decimal.from(36.52), Decimal.from(51.23)].map((amount, i: BLusdAmmTokenIndex) => (
            <>
              {i > 0 && <Text sx={{ fontWeight: "light", mx: 3 }}>+</Text>}
              <WithdrawnAmount symbol={tokenSymbol[i]}>{amount.prettify(2)}</WithdrawnAmount>
            </>
          ))}
        </Flex>
      </DisabledEditableRow>

      {isBalanceInsufficient && (
        <ErrorDescription>
          Amount exceeds your balance by{" "}
          <Amount>
            {burnLP.sub(inputTokenBalance).prettify(2)} {tokenSymbol[inputToken]}
          </Amount>
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={handleBackPressed}
          disabled={isApprovePending || isManageLiquidityPending}
        >
          Back
        </Button>

        <Button
          variant="primary"
          onClick={handleConfirmPressed}
          disabled={isBalanceInsufficient || isManageLiquidityPending}
        >
          {isManageLiquidityPending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Confirm</>}
        </Button>
      </Flex>
    </>
  );
};
