import React from "react";
import { None } from "./views/None";
import { Stake } from "./views/Stake/Stake";
import { Adjust } from "./views/Adjust/Adjust";
import { Active } from "./views/Active";
import { useMineView } from "./context/MineViewContext";

export const Mine: React.FC = props => {
  const { view } = useMineView();

  switch (view) {
    case "NONE": {
      return <None {...props} />;
    }
    case "STAKE": {
      return <Stake {...props} />;
    }
    case "ADJUST": {
      return <Adjust {...props} />;
    }
    case "ACTIVE": {
      return <Active {...props} />;
    }
  }
};
