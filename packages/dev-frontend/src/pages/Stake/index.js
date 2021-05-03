import { useState } from "react";

import Tabs from "../../components/Tabs";
import StakingManager from "../../components/Staking/StakingManager";
import { useStakingView } from "../../components/Staking/context/StakingViewContext";

const TABS = [
  { tab: "lqty", content: "Stake LQTY" },
  { tab: "unilp", content: "Stake UNI LP " }
];

const Stake = () => {
  const [activeTab, setActiveTab] = useState("lqty");
  const { view } = useStakingView();

  return (
    <>
      <Tabs activeTab={activeTab} tabs={TABS} setActiveTab={setActiveTab} />
      <StakingManager view={view} />
    </>
  );
};

export default Stake;
