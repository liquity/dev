import React from "react";
import { TroveManager } from "./TroveManager";
import { ReadOnlyTrove } from "./ReadOnlyTrove";
import { NoTrove } from "./NoTrove";
import { Opening } from "./Opening";
import { Adjusting } from "./Adjusting";
import { RedeemedTrove } from "./RedeemedTrove";
import { useTroveView } from "./context/TroveViewContext";
import { LiquidatedTrove } from "./LiquidatedTrove";
import { Decimal } from "@liquity/lib-base";

export const Trove: React.FC = props => {
  const { view } = useTroveView();

  switch (view) {
    // loading state not needed, as main app has a loading spinner that blocks render until the liquity backend data is available
    case "ACTIVE": {
      return <ReadOnlyTrove {...props} />;
    }
    case "ADJUSTING": {
      return <Adjusting {...props} />;
    }
    case "CLOSING": {
      return <TroveManager {...props} collateral={Decimal.ZERO} debt={Decimal.ZERO} />;
    }
    case "OPENING": {
      return <Opening {...props} />;
    }
    case "LIQUIDATED": {
      return <LiquidatedTrove {...props} />;
    }
    case "REDEEMED": {
      return <RedeemedTrove {...props} />;
    }
    case "NONE": {
      return <NoTrove {...props} />;
    }
  }
};
