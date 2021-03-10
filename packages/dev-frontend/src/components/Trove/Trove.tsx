import React from "react";
import { TroveManager } from "./TroveManager";
import { ReadOnlyTrove } from "./ReadOnlyTrove";
import { NoTrove } from "./NoTrove";
import { ClosedTrove } from "./ClosedTrove";
import { useTroveView } from "./context/TroveViewContext";

export const Trove: React.FC = props => {
  const { view } = useTroveView();

  switch (view) {
    // loading state not needed, as main app has a loading spinner that blocks render until the liquity backend data is available
    case "ACTIVE": {
      return <ReadOnlyTrove {...props} />;
    }
    case "ADJUSTING": {
      return <TroveManager {...props} />;
    }
    case "OPENING": {
      return <TroveManager {...props} />;
    }
    case "LIQUIDATED": {
      return <ClosedTrove {...props} />;
    }
    case "REDEEMED": {
      return <ClosedTrove {...props} />;
    }
    case "NONE": {
      return <NoTrove {...props} />;
    }
  }
};
