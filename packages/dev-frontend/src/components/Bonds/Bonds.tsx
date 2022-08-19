import React from "react";
import { useBondView } from "./context/BondViewContext";
import { Idle } from "./views/idle/Idle";
import { Actioning } from "./views/actioning/Actioning";
import { Creating } from "./views/creating/Creating";

export const Bonds: React.FC = () => {
  const { view } = useBondView();
  let View = null;
  switch (view) {
    case "CANCELLING":
    case "CLAIMING": {
      View = <Actioning />;
      break;
    }
    case "CREATING": {
      View = <Creating />;
      break;
    }
  }

  return (
    <>
      <Idle />
      {View}
    </>
  );
};
