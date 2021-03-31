import React from "react";
import { Inactive } from "./views/Inactive/Inactive";
import { Staking } from "./views/Staking/Staking";
import { Adjusting } from "./views/Adjusting/Adjusting";
import { Active } from "./views/Active/Active";
import { Disabled } from "./views/Disabled/Disabled";
import { useFarmView } from "./context/FarmViewContext";

export const Farm: React.FC = props => {
  const { view } = useFarmView();

  switch (view) {
    case "INACTIVE": {
      return <Inactive {...props} />;
    }
    case "STAKING": {
      return <Staking {...props} />;
    }
    case "ADJUSTING": {
      return <Adjusting {...props} />;
    }
    case "ACTIVE": {
      return <Active {...props} />;
    }
    case "DISABLED": {
      return <Disabled {...props} />;
    }
  }
};
