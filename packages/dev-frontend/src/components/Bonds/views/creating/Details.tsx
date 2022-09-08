/** @jsxImportSource theme-ui */
import React, { useEffect, useMemo, useState } from "react";
import { Flex, Heading, Button, Card, Grid, Close, Text, Image, Spinner } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { EditableRow } from "../../../Trove/Editor";
import { Record } from "../../Record";
import { InfoIcon } from "../../../InfoIcon";
import { useBondView } from "../../context/BondViewContext";
import { HorizontalTimeline, Label, SubLabel } from "../../../HorizontalTimeline";
import { ActionDescription } from "../../../ActionDescription";
import { EXAMPLE_NFT } from "../../context/BondViewProvider";
import * as l from "../../lexicon";
import { useWizard } from "../../../Wizard/Context";
import { Warning } from "../../../Warning";
import type { CreateBondPayload } from "../../context/transitions";
import { dateWithoutHours, getRebondDays, getReturn, percentify, toFloat } from "../../utils";
import { HorizontalSlider } from "../../../HorizontalSlider";

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

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED");
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", { deposit } as CreateBondPayload);
  };

  useEffect(() => {
    return () => resetSimulatedMarketPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (protocolInfo === undefined || simulatedProtocolInfo === undefined || lusdBalance === undefined)
    return null;

  const depositMinusClaimBondFee = Decimal.ONE.sub(protocolInfo.claimBondFee).mul(deposit);
  const rebondReturn = getReturn(
    depositMinusClaimBondFee.mul(simulatedProtocolInfo.rebondAccrualFactor),
    deposit,
    simulatedProtocolInfo.simulatedMarketPrice
  );
  const rebondRoi = rebondReturn / toFloat(deposit) || 0;
  const marketPriceMin = protocolInfo.floorPrice.add(0.015).prettify(2); // Add 0.015 to prevent market_price=floor_price infinity issues
  const marketPriceMax = Decimal.max(
    protocolInfo.marketPrice.mul(1.1),
    protocolInfo.floorPrice.mul(1.5)
  ).prettify(2);
  const rebondDays = getRebondDays(
    simulatedProtocolInfo.alphaAccrualFactor,
    simulatedProtocolInfo.marketPricePremium,
    protocolInfo.claimBondFee
  );

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
              date: simulatedProtocolInfo.breakEvenTime,
              label: (
                <>
                  <Label description={l.BREAK_EVEN_TIME.description}>{l.BREAK_EVEN_TIME.term}</Label>
                  <SubLabel>{`${depositMinusClaimBondFee
                    .mul(simulatedProtocolInfo.breakEvenAccrualFactor)
                    .prettify(2)} bLUSD`}</SubLabel>
                </>
              )
            },
            {
              date: simulatedProtocolInfo.rebondTime,
              label: (
                <>
                  <Label description={l.OPTIMUM_REBOND_TIME.description}>
                    {l.OPTIMUM_REBOND_TIME.term}
                  </Label>
                  <SubLabel>{`${depositMinusClaimBondFee
                    .mul(simulatedProtocolInfo.rebondAccrualFactor)
                    .prettify(2)} bLUSD`}</SubLabel>
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
        setEditedAmount={amount => setDeposit(Decimal.min(lusdBalance, Decimal.from(amount)))}
        maxAmount={lusdBalance.toString()}
        maxedOut={deposit.eq(lusdBalance)}
      ></EditableRow>

      <Grid sx={{ my: 1, mb: 3, justifyItems: "center", pl: 2 }} gap="20px" columns={3}>
        <Record
          name={l.REBOND_RETURN.term}
          value={rebondReturn.toFixed(2)}
          type="LUSD"
          description={l.REBOND_RETURN.description}
        />

        <Record
          name={l.REBOND_TIME_ROI.term}
          value={percentify(rebondRoi).toFixed(2) + "%"}
          type=""
          description={l.REBOND_TIME_ROI.description}
        />

        <Record
          name={l.OPTIMUM_APY.term}
          value={percentify(rebondRoi * (365 / toFloat(rebondDays))).toFixed(2) + "%"}
          type=""
          description={l.OPTIMUM_APY.description}
        />
      </Grid>

      <HorizontalSlider
        name={"Simulate market price"}
        description={`
                The market price of bLUSD impacts how long it will take to rebond and break even. The
                market price has a minimum value ("floor price") which is determined by the
                Treasury's Reserve bucket relative to the bLUSD supply.`}
        value={simulatedProtocolInfo.simulatedMarketPrice}
        min={marketPriceMin}
        max={marketPriceMax}
        type="LUSD"
        onSliderChange={value => setSimulatedMarketPrice(value)}
        onReset={() => setSimulatedMarketPrice(protocolInfo.marketPrice)}
      />

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
