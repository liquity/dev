/** @jsxImportSource theme-ui */
import React, { useEffect, useMemo, useState } from "react";
import { Flex, Heading, Button, Card, Grid, Close, Text, Image, Spinner } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { EditableRow } from "../../../Trove/Editor";
import { Record } from "../../Record";
import { InfoIcon } from "../../../InfoIcon";
import { useBondView } from "../../context/BondViewContext";
import { HorizontalTimeline, Label, SubLabel, UNKNOWN_DATE } from "../../../HorizontalTimeline";
import { ActionDescription } from "../../../ActionDescription";
import { EXAMPLE_NFT } from "../../context/BondViewProvider";
import * as l from "../../lexicon";
import { useWizard } from "../../../Wizard/Context";
import { Warning } from "../../../Warning";
import type { CreateBondPayload } from "../../context/transitions";
import {
  dateWithoutHours,
  getReturn,
  percentify,
  toFloat,
  getRemainingRebondOrBreakEvenDays,
  getBreakEvenPeriodInDays,
  getRebondPeriodInDays,
  getRebondOrBreakEvenTimeWithControllerAdjustment
} from "../../utils";
import { HorizontalSlider } from "../../../HorizontalSlider";
import { ErrorDescription } from "../../../ErrorDescription";
import { Amount } from "../../../ActionDescription";
import { InfiniteEstimate } from "../InfiniteEstimation";
import { LearnMoreLink } from "../../../Tooltip";

type DetailsProps = { onBack?: () => void };

export const Details: React.FC<DetailsProps> = ({ onBack }) => {
  const {
    dispatchEvent,
    statuses,
    isInfiniteBondApproved,
    lusdBalance,
    simulatedProtocolInfo,
    setSimulatedMarketPrice,
    resetSimulatedMarketPrice,
    protocolInfo
  } = useBondView();
  const { back } = useWizard();
  const [deposit, setDeposit] = useState<Decimal>(lusdBalance ?? Decimal.ZERO);
  const depositEditingState = useState<string>();
  const isApprovingOrConfirming = useMemo(
    () => statuses.APPROVE === "PENDING" || statuses.CREATE === "PENDING",
    [statuses.APPROVE, statuses.CREATE]
  );
  const handleBack = back ?? onBack ?? (() => dispatchEvent("BACK_PRESSED"));
  const [isDepositEnough, setIsDepositEnough] = useState<boolean>(lusdBalance?.gte(100) ?? true);
  const [doesDepositExceedBalance, setDoesDepositExceedBalance] = useState<boolean>(false);

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED");
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", { deposit } as CreateBondPayload);
  };

  const handleDepositAmountChanged = (amount: Decimal) => {
    const isDepositEnough = amount.gte(100);
    const doesDepositExceedBalance = !!lusdBalance?.lt(amount);
    setDeposit(amount);
    setIsDepositEnough(isDepositEnough);
    setDoesDepositExceedBalance(doesDepositExceedBalance);
  };

  useEffect(() => {
    return () => resetSimulatedMarketPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (protocolInfo === undefined || simulatedProtocolInfo === undefined || lusdBalance === undefined)
    return null;

  const hasMarketPremium = simulatedProtocolInfo.hasMarketPremium;
  const depositMinusClaimBondFee = Decimal.ONE.sub(protocolInfo.claimBondFee).mul(deposit);
  const rebondReturn = getReturn(
    depositMinusClaimBondFee.mul(simulatedProtocolInfo.rebondAccrualFactor),
    deposit,
    simulatedProtocolInfo.simulatedMarketPrice
  );
  const rebondRoi = rebondReturn / toFloat(deposit) || 0;
  const marketPriceMin = protocolInfo.floorPrice.mul(1.025).prettify(2); // Enough to display what happens below the 3% chicken in fee
  const marketPriceMax = Decimal.max(
    protocolInfo.marketPrice.mul(1.1),
    protocolInfo.floorPrice.mul(1.5)
  ).prettify(2);

  const rebondDays = getRebondPeriodInDays(
    simulatedProtocolInfo.alphaAccrualFactor,
    simulatedProtocolInfo.marketPricePremium,
    protocolInfo.claimBondFee
  );

  const controllerAdjustedRebondDays = getRemainingRebondOrBreakEvenDays(
    Decimal.ZERO,
    simulatedProtocolInfo.controllerTargetAge,
    simulatedProtocolInfo.averageBondAge,
    rebondDays
  );

  const breakEvenDays = getBreakEvenPeriodInDays(
    simulatedProtocolInfo.alphaAccrualFactor,
    simulatedProtocolInfo.marketPricePremium,
    protocolInfo.claimBondFee
  );

  const breakEvenTime = breakEvenDays.eq(Decimal.INFINITY)
    ? UNKNOWN_DATE
    : getRebondOrBreakEvenTimeWithControllerAdjustment(
        Decimal.ZERO,
        simulatedProtocolInfo.controllerTargetAge,
        simulatedProtocolInfo.averageBondAge,
        breakEvenDays
      );

  const rebondTime = rebondDays.eq(Decimal.INFINITY)
    ? UNKNOWN_DATE
    : getRebondOrBreakEvenTimeWithControllerAdjustment(
        Decimal.ZERO,
        simulatedProtocolInfo.controllerTargetAge,
        simulatedProtocolInfo.averageBondAge,
        rebondDays
      );

  const breakEvenAccrual = hasMarketPremium
    ? depositMinusClaimBondFee.mul(simulatedProtocolInfo.breakEvenAccrualFactor)
    : Decimal.INFINITY;

  const rebondAccrual = hasMarketPremium
    ? depositMinusClaimBondFee.mul(simulatedProtocolInfo.rebondAccrualFactor)
    : Decimal.INFINITY;

  return (
    <>
      <Heading as="h2" sx={{ pt: 1, pb: 3, px: 2 }}>
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

      <Flex sx={{ justifyContent: "center", alignItems: "center" }}>
        <Image
          sx={{
            height: 180,
            border: "10px solid white",
            borderRadius: "14%",
            borderColor: "white"
          }}
          src={EXAMPLE_NFT}
        />
        <InfoIcon
          tooltip={
            <Card variant="tooltip" sx={{ width: "200px" }}>
              {l.BOND_NFT.description}
            </Card>
          }
        />
      </Flex>

      <Flex my={4} sx={{ justifyContent: "center" }}>
        <HorizontalTimeline
          events={[
            {
              date: new Date(dateWithoutHours(Date.now())),
              label: (
                <>
                  <Label subLabel="0 bLUSD" description={l.BOND_CREATED.description}>
                    {l.BOND_CREATED.term}
                  </Label>
                  <SubLabel>0 bLUSD</SubLabel>
                </>
              ),
              isEndOfLife: true
            },
            {
              date: breakEvenTime,
              label: (
                <>
                  <Label description={l.BREAK_EVEN_TIME.description}>{l.BREAK_EVEN_TIME.term}</Label>
                  <SubLabel>
                    <InfiniteEstimate estimate={breakEvenAccrual}>
                      {breakEvenAccrual.prettify(2)} bLUSD
                    </InfiniteEstimate>
                  </SubLabel>
                </>
              )
            },
            {
              date: rebondTime,
              label: (
                <>
                  <Label description={l.OPTIMUM_REBOND_TIME.description}>
                    {l.OPTIMUM_REBOND_TIME.term}
                  </Label>
                  <SubLabel>
                    <InfiniteEstimate estimate={rebondAccrual}>
                      {rebondAccrual.prettify(2)} bLUSD
                    </InfiniteEstimate>
                  </SubLabel>
                </>
              )
            }
          ]}
        />
      </Flex>

      <EditableRow
        label={l.BOND_DEPOSIT.term}
        inputId="bond-deposit-amount"
        amount={deposit.prettify(2)}
        unit="LUSD"
        editingState={depositEditingState}
        editedAmount={deposit.toString()}
        setEditedAmount={amount => handleDepositAmountChanged(Decimal.from(amount))}
        maxedOut={deposit.eq(lusdBalance)}
        maxAmount={lusdBalance.toString()}
      />

      <Grid sx={{ my: 1, mb: 3, justifyItems: "center", pl: 2 }} gap="20px" columns={3}>
        <Record
          lexicon={l.REBOND_RETURN}
          value={hasMarketPremium ? rebondReturn.toFixed(2) : "N/A"}
          type="LUSD"
        />

        <Record
          lexicon={l.REBOND_TIME_ROI}
          value={hasMarketPremium ? percentify(rebondRoi).toFixed(2) + "%" : "N/A"}
          type=""
        />

        <Record
          lexicon={l.OPTIMUM_APY}
          value={
            hasMarketPremium
              ? percentify(rebondRoi * (365 / controllerAdjustedRebondDays)).toFixed(2) + "%"
              : "N/A"
          }
          type=""
        />
      </Grid>

      <HorizontalSlider
        name={"Simulate market price"}
        description={`The market price of bLUSD impacts how long it will take to rebond and break even. The actual times may be overestimated as the simulator is based on the current bLUSD accrual rate, not taking into account potential rate adjustments.`}
        descriptionLink="https://docs.chickenbonds.org/faq/economic-design#_44lrt4qpho3a"
        value={simulatedProtocolInfo.simulatedMarketPrice}
        min={marketPriceMin}
        max={marketPriceMax}
        type="LUSD"
        onSliderChange={value => setSimulatedMarketPrice(value)}
        onReset={() => resetSimulatedMarketPrice()}
      />

      {!protocolInfo.hasMarketPremium && (
        <Warning>
          When the bLUSD market price is less than 3% above the floor price, it's not profitable to
          bond. Buying bLUSD from the market currently generates a higher return than bonding.{" "}
          <LearnMoreLink link={l.INFINITE_ESTIMATION.link} />
        </Warning>
      )}

      {!isInfiniteBondApproved && (
        <ActionDescription>
          <Text>You are approving LUSD for bonding</Text>
        </ActionDescription>
      )}

      {statuses.APPROVE === "FAILED" && (
        <Warning>Failed to approve spend of LUSD. Please try again.</Warning>
      )}

      {statuses.CREATE === "FAILED" && <Warning>Failed to create bond. Please try again.</Warning>}

      {isInfiniteBondApproved && (
        <ActionDescription>
          You are bonding <Text sx={{ fontWeight: "bold" }}>{deposit.prettify(2)} LUSD</Text>
        </ActionDescription>
      )}

      {!isDepositEnough && <ErrorDescription>The minimum bond amount is 100 LUSD.</ErrorDescription>}
      {doesDepositExceedBalance && (
        <ErrorDescription>
          Amount exceeds your balance by <Amount>{deposit.sub(lusdBalance).prettify(2)} LUSD</Amount>
        </ErrorDescription>
      )}

      <Flex pb={2} sx={{ fontSize: "15.5px", justifyContent: "center", fontStyle: "italic" }}>
        You can cancel your bond at any time to recover your deposited LUSD
      </Flex>

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBack} disabled={isApprovingOrConfirming}>
          Back
        </Button>
        {!isInfiniteBondApproved && (
          <Button onClick={handleApprovePressed} disabled={isApprovingOrConfirming}>
            {!isApprovingOrConfirming && <>Approve</>}
            {isApprovingOrConfirming && (
              <Spinner size="28px" sx={{ color: "white", position: "absolute" }} />
            )}
          </Button>
        )}
        {isInfiniteBondApproved && (
          <Button onClick={handleConfirmPressed} disabled={isApprovingOrConfirming}>
            {!isApprovingOrConfirming && <>Confirm</>}
            {isApprovingOrConfirming && <Spinner size="28px" sx={{ color: "white" }} />}
          </Button>
        )}
      </Flex>
    </>
  );
};
