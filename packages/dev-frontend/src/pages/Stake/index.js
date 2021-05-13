import { useState, useEffect } from "react";

import Tabs from "../../components/Tabs";
import StakingManager from "../../components/Staking/StakingManager";
import { Farm } from "../../components/Farm/Farm";
import { useStakingView } from "../../components/Staking/context/StakingViewContext";

const TABS = [
  { tab: "lqty", content: "Stake LQTY" },
  { tab: "unilp", content: "Stake UNI LP " }
];

let presistActiveTab = null;

const Stake = () => {
  const [activeTab, setActiveTab] = useState(presistActiveTab || "lqty");
  const { view } = useStakingView();

  useEffect(() => {
    presistActiveTab = activeTab;
  }, [activeTab]);

  return (
    <>
      <Tabs activeTab={activeTab} tabs={TABS} setActiveTab={setActiveTab} />
      {activeTab === "lqty" && <StakingManager view={view} />}
      {activeTab === "unilp" && <Farm view={view} />}
    </>
  );
};

export default Stake;
