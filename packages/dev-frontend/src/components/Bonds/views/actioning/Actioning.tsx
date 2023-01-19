/** @jsxImportSource theme-ui */
import React from "react";
import { Flex, Heading, Grid, Close, Box } from "theme-ui";
import { Record } from "../../Record";
import { useBondView } from "../../context/BondViewContext";
import { HorizontalTimeline, Label, SubLabel } from "../../../HorizontalTimeline";
import type { EventType } from "../../../HorizontalTimeline";
import * as l from "../../lexicon";
import { Cancel } from "./actions/cancel/Cancel";
import { Claim } from "./actions/claim/Claim";
import { Warning } from "../../../Warning";
import { ReactModal } from "../../../ReactModal";
import { percentify } from "../../utils";
import { Decimal } from "@liquity/lib-base";
import { InfiniteEstimate } from "../InfiniteEstimation";

export const Actioning: React.FC = () => {
  const { dispatchEvent, view, selectedBond: bond } = useBondView();

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  if (bond === undefined) return null;

  let Actions;
  switch (view) {
    case "CANCELLING": {
      Actions = <Cancel />;
      break;
    }
    case "CLAIMING": {
      Actions = <Claim />;
      break;
    }
  }

  const events: EventType[] = [
    {
      date: new Date(bond.startTime),
      label: (
        <>
          <Label description={l.BOND_CREATED.description}>{l.BOND_CREATED.term}</Label>
          <SubLabel>{`0 bLUSD`}</SubLabel>
        </>
      )
    },
    {
      date: new Date(bond.breakEvenTime),
      label: (
        <>
          <Label description={l.BREAK_EVEN_TIME.description}>{l.BREAK_EVEN_TIME.term}</Label>
          <SubLabel>
            <InfiniteEstimate estimate={bond.breakEvenAccrual}>
              {bond.breakEvenAccrual.prettify(2)} bLUSD
            </InfiniteEstimate>
          </SubLabel>
        </>
      )
    },
    {
      date: new Date(bond.rebondTime),
      label: (
        <>
          <Label description={l.OPTIMUM_REBOND_TIME.description}>{l.OPTIMUM_REBOND_TIME.term}</Label>
          <SubLabel>
            <InfiniteEstimate estimate={bond.rebondAccrual}>
              {bond.rebondAccrual.prettify(2)} bLUSD
            </InfiniteEstimate>
          </SubLabel>
        </>
      )
    },
    {
      date: new Date(Date.now()),
      label: (
        <>
          <Label description={l.ACCRUED_AMOUNT.description} style={{ fontWeight: 500 }}>
            {l.ACCRUED_AMOUNT.term}
          </Label>
          <SubLabel style={{ fontWeight: 400 }}>{`${bond.accrued.prettify(2)} bLUSD`}</SubLabel>
        </>
      ),
      isEndOfLife: true,
      isMilestone: false
    }
  ];

  return (
    <ReactModal onDismiss={handleDismiss}>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>
          {view === "CANCELLING" ? l.CANCEL_BOND.term : l.CLAIM_BOND.term}
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
      <Flex my={4} mx={2} sx={{ justifyContent: "center" }}>
        <HorizontalTimeline events={events} />
      </Flex>
      <Grid gap="12px" columns={3} sx={{ my: 4, justifyItems: "center" }}>
        <Record lexicon={l.BOND_DEPOSIT} value={bond.deposit.prettify(2)} type="LUSD" />

        <Record lexicon={l.MARKET_VALUE} value={bond.marketValue.prettify(2)} type="LUSD" />

        {view === "CLAIMING" && (
          <Record lexicon={l.BOND_RETURN} value={bond.claimNowReturn.toFixed(2)} type="LUSD" />
        )}
      </Grid>
      <details>
        <summary sx={{ pl: 2, mt: 4, cursor: "pointer" }}>Rebond estimations</summary>
        <Grid gap="20px" columns={3} sx={{ my: 2, justifyItems: "center" }}>
          <Record
            lexicon={l.REBOND_RETURN}
            value={bond.rebondAccrual.eq(Decimal.INFINITY) ? "N/A" : bond.rebondReturn.toFixed(2)}
            type="LUSD"
          />

          <Record
            lexicon={l.REBOND_TIME_ROI}
            value={
              bond.rebondAccrual.eq(Decimal.INFINITY)
                ? "N/A"
                : percentify(bond.rebondRoi).toFixed(2) + "%"
            }
          />

          <Record
            lexicon={l.OPTIMUM_APY}
            value={
              bond.rebondAccrual.eq(Decimal.INFINITY)
                ? "N/A"
                : percentify(bond.rebondApr).toFixed(2) + "%"
            }
          />
        </Grid>
      </details>

      <Box mt={3}>
        {view === "CLAIMING" && bond.claimNowReturn < 0 && (
          <Warning>You are claiming a bond which currently has a negative return</Warning>
        )}
        {view === "CANCELLING" && bond.accrued.gte(bond.breakEvenAccrual) && (
          <Warning>Your are cancelling a bond which has accrued a positive return</Warning>
        )}
      </Box>

      {Actions}
    </ReactModal>
  );
};
