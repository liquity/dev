import { Card, Flex, ThemeUIStyleObject } from "theme-ui";
import { EventType, HorizontalTimeline, UNKNOWN_DATE } from "../../../HorizontalTimeline";
import { Record } from "../../Record";
import { Actions } from "./actions/Actions";
import type { OptimisticBond as OptimisticBondType } from "../../context/transitions";
import { Label, SubLabel } from "../../../HorizontalTimeline";
import * as l from "../../lexicon";
import { Placeholder } from "../../../Placeholder";

const getBondEvents = (bond: OptimisticBondType): EventType[] => {
  return [
    {
      date: new Date(bond.startTime),
      label: (
        <>
          <Label description="bLUSD accrual starts off at 0 and increases over time.">
            {l.BOND_CREATED.term}
          </Label>
          <SubLabel>{`0.00 bLUSD`}</SubLabel>
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
          <SubLabel style={{ fontWeight: 400 }}></SubLabel>
        </>
      ),
      isEndOfLife: true
    },
    {
      date: UNKNOWN_DATE,
      label: (
        <>
          <Label description="How many bLUSD are required to break-even at the current market price.">
            {l.BREAK_EVEN_TIME.term}
          </Label>
          <SubLabel style={{ fontWeight: 400 }}></SubLabel>
        </>
      ),
      isLoading: true
    },
    {
      date: UNKNOWN_DATE,
      label: (
        <>
          <Label description="How many bLUSD are recommended before claiming the bond, selling the bLUSD for LUSD, and then opening another bond.">
            {l.OPTIMUM_REBOND_TIME.term}
          </Label>
          <SubLabel style={{ fontWeight: 400 }}></SubLabel>
        </>
      ),
      isLoading: true
    }
  ];
};

type BondProps = { bond: OptimisticBondType; style?: ThemeUIStyleObject };

export const OptimisticBond: React.FC<BondProps> = ({ bond, style }) => {
  const events = getBondEvents(bond);

  return (
    <Flex
      sx={{
        justifyContent: "center",
        alignItems: "center",
        gap: "12px",
        ...style
      }}
    >
      <Flex sx={{ width: 150, height: 210 }}>
        <Placeholder />
      </Flex>
      <Card mt={[0, 0, 0, 0]} sx={{ borderRadius: 12, flexGrow: 1 }}>
        <Flex p={[2, 3]} sx={{ flexDirection: "column" }}>
          <HorizontalTimeline
            style={{ fontSize: "14.5px", justifyContent: "center", pt: 2, mx: 3 }}
            events={events}
          />

          <Flex mt={4} variant="layout.actions" sx={{ justifyContent: "flex-end" }}>
            <Flex
              sx={{
                justifyContent: "flex-start",
                flexGrow: 1,
                alignItems: "center",
                pl: 4,
                gap: "0 28px",
                fontSize: "14.5px"
              }}
            >
              <Record lexicon={l.BOND_DEPOSIT} value={bond.deposit.prettify(2)} type="LUSD" />

              <Record lexicon={l.MARKET_VALUE} type="LUSD" />
            </Flex>
            <Actions bondId={bond.id} disabled />
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};
