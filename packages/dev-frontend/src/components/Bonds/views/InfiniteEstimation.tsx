import { Decimal, Decimalish } from "@liquity/lib-base";
import { InfoIcon } from "../../InfoIcon";
import { Card } from "theme-ui";
import * as l from "../lexicon";

type InfiniteEstimateProps = {
  estimate: Decimalish;
};

export const InfiniteEstimate: React.FC<InfiniteEstimateProps> = ({ estimate, children }) => {
  if (estimate.toString() !== Decimal.INFINITY.toString()) return <>{children ?? estimate}</>;

  return (
    <>
      {Decimal.INFINITY.toString()}
      <InfoIcon
        size="xs"
        tooltip={<Card variant="tooltip">{l.INFINITE_ESTIMATION.description}</Card>}
      />
      &nbsp;
    </>
  );
};
