import { Card, Flex, Button, Link, Image, ThemeUIStyleObject } from "theme-ui";
import { EventType, HorizontalTimeline } from "../../../HorizontalTimeline";
import { nfts } from "../../context/BondViewProvider";
import { Record } from "../../Record";
import { Actions } from "./actions/Actions";
import type { Bond as BondType } from "../../context/transitions";
import { Label, SubLabel } from "../../../HorizontalTimeline";
import * as l from "../../lexicon";
import { statuses } from "../../context/BondViewContext";
import { milliseconds } from "../../utils";

const getBondEvents = (bond: BondType): EventType[] => {
  return [
    {
      date: new Date(milliseconds(bond.startTime)),
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
      date: new Date(
        bond.status === "PENDING" ? Date.now() : "endTime" in bond ? milliseconds(bond.endTime) : 0
      ),
      label: (
        <>
          <Label
            description="Number of bLUSD this bond has accrued so far."
            style={{ fontWeight: 500 }}
          >
            {bond.status === "PENDING" ? l.ACCRUED_AMOUNT.term : statuses[bond.status]}
          </Label>
          <SubLabel>{`${bond.accrued.prettify(2)} bLUSD`}</SubLabel>
        </>
      ),
      isSelected: true
    },
    {
      date: new Date(bond.breakEvenTime),
      label: (
        <>
          <Label description="How many bLUSD are required to break-even at the current market price.">
            {l.BREAK_EVEN_TIME.term}
          </Label>
          <SubLabel>{`${
            "breakEvenAccrual" in bond ? bond.breakEvenAccrual.prettify(2) : "?"
          } bLUSD`}</SubLabel>
        </>
      )
    },
    {
      date: new Date(bond.rebondTime),
      label: (
        <>
          <Label description="How many bLUSD are recommended before claiming the bond, selling the bLUSD for LUSD, and then opening another bond.">
            {l.OPTIMUM_REBOND_TIME.term}
          </Label>
          <SubLabel>{`${
            "rebondAccrual" in bond ? bond.rebondAccrual.prettify(2) : "?"
          } bLUSD`}</SubLabel>
        </>
      )
    }
  ];
};

type BondProps = { bond: BondType; style?: ThemeUIStyleObject };

export const Bond: React.FC<BondProps> = ({ bond, style }) => {
  const events = getBondEvents(bond);

  return (
    <Card sx={{ m: 0, p: 0, ...style }}>
      <Flex>
        {bond.status === "PENDING" && (
          <Image
            sx={{ width: "160px", cursor: "pointer" }}
            src={nfts[bond.status]}
            alt="TODO"
            onClick={() => {
              window.open("https://opensea.io", "_blank");
            }}
          />
        )}
        {bond.status === "CANCELLED" && (
          <>
            <Image sx={{ width: "160px" }} src={nfts.PENDING} />
            <Image
              sx={{
                width: "160px",
                cursor: "pointer",
                borderRadius: "50%",
                backgroundColor: "transparent",
                ml: "-160px",
                p: "28px"
              }}
              src={nfts[bond.status]}
              alt="TODO"
              onClick={() => {
                window.open("https://opensea.io", "_blank");
              }}
            />
          </>
        )}
        {bond.status === "CLAIMED" && (
          <>
            <Image sx={{ width: "160px" }} src={nfts.PENDING} />
            <Image
              sx={{
                width: "160px",
                cursor: "pointer",
                borderRadius: "50%",
                backgroundColor: "transparent",
                ml: "-160px",
                p: "28px"
              }}
              src={nfts[bond.status]}
              alt="TODO"
              onClick={() => {
                window.open("https://opensea.io", "_blank");
              }}
            />
          </>
        )}
        <Flex p={[2, 3]} sx={{ flexDirection: "column", flexGrow: 1 }}>
          <HorizontalTimeline
            style={{ fontSize: "14.5px", justifyContent: "center", pt: 2, mx: 3 }}
            events={events}
          />

          <Flex variant="layout.actions" sx={{ justifyContent: "flex-end" }}>
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
              <Record
                name={l.BOND_DEPOSIT.term}
                value={bond.deposit.prettify(2)}
                type="LUSD"
                description={l.BOND_DEPOSIT.description}
              />
              <Record
                name={l.MARKET_VALUE.term}
                value={"marketValue" in bond ? bond.marketValue.prettify(2) : "0"}
                type="LUSD"
                description={l.MARKET_VALUE.description}
              />
            </Flex>
            {bond.status === "PENDING" && <Actions bondId={bond.id} />}
            {bond.status !== "PENDING" && bond.status === "CLAIMED" && (
              <Button variant="outline" sx={{ height: "44px" }}>
                <Link
                  variant="outline"
                  href="https://curve.fi"
                  sx={{ textDecoration: "none" }}
                  target="external"
                >
                  Sell bLUSD
                </Link>
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
};
