import { useEffect } from "react";

import TroveManager from "./TroveManager";

const TroveWidget = ({ activeTab, view, dispatchEvent }) => {
  useEffect(() => {
    view === "ACTIVE" && dispatchEvent("ADJUST_TROVE_PRESSED");
  }, [dispatchEvent, view]);

  return <TroveManager activeTab={activeTab} />;
};

export default TroveWidget;
