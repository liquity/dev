import React from "react";
import { Inactive } from "./views/Inactive/Inactive";
import { Staking } from "./views/Staking/Staking";
import { Adjusting } from "./views/Adjusting/Adjusting";
import { Active } from "./views/Active/Active";
import { Disabled } from "./views/Disabled/Disabled";
import { XbrlStblInactive } from "./xbrlStblViews/Inactive/XbrlStblInactive";
import { XbrlStblStaking } from "./xbrlStblViews/Staking/XbrlStblStaking";
import { XbrlStblAdjusting } from "./xbrlStblViews/Adjusting/XbrlStblAdjusting";
import { XbrlStblActive } from "./xbrlStblViews/Active/XbrlStblActive";
import { XbrlStblDisabled } from "./xbrlStblViews/Disabled/XbrlStblDisabled";
import { useFarmView } from "./context/FarmViewContext";
import { FarmView } from "./context/transitions";
import { useXbrlStblFarmView } from "./context/XbrlStblFarmViewContext";
import { Flex } from "theme-ui";

const checkXbrlStblFarmView = ({ view, ...props }: { view: FarmView, props: {
  children?: React.ReactNode;
}}): JSX.Element => {
  switch (view) {
    case "INACTIVE": {
      return <XbrlStblInactive />;
    }
    case "STAKING": {
      return <XbrlStblStaking />;
    }
    case "ADJUSTING": {
      return <XbrlStblAdjusting />;
    }
    case "ACTIVE": {
      return <XbrlStblActive />;
    }
    case "DISABLED": {
      return <XbrlStblDisabled />;
    }
  }
}

const checkXbrlWethFarmView = ({ view, ...props }: { view: FarmView, props: {
  children?: React.ReactNode;
}}): JSX.Element => {
  switch (view) {
    case "INACTIVE": {
      return <Inactive />;
    }
    case "STAKING": {
      return <Staking />;
    }
    case "ADJUSTING": {
      return <Adjusting />;
    }
    case "ACTIVE": {
      return <Active />;
    }
    case "DISABLED": {
      return <Disabled />;
    }
  }
}

export const Farm: React.FC = props => {
  const { view } = useFarmView();
  const { xbrlStblView } = useXbrlStblFarmView();

  return <Flex sx={{ flexDirection: "column", gap: 3 }}>
    { checkXbrlWethFarmView({ view, props })}
    { checkXbrlStblFarmView({ view: xbrlStblView, props }) }
  </Flex>
};
