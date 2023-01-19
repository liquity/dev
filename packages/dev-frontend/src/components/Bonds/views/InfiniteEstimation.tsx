import { Decimal, Decimalish } from "@liquity/lib-base";
import { InfoIcon } from "../../InfoIcon";
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
        tooltip={l.INFINITE_ESTIMATION.description}
        link={l.INFINITE_ESTIMATION.link}
      />
      &nbsp;
    </>
  );
};
