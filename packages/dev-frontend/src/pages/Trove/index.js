import { useState } from "react";

import useTroveView from "../../components/TroveWidget/context/TroveViewContext";
import Tabs from "../../components/Tabs";
import TroveHead from "../../components/TroveWidget/TroveHead";
import TroveWidget from "../../components/TroveWidget";
import Redemption from "../../components/Redemption/Redemption";
import SurplusAction from "../../components/TroveWidget/SurplusAction";

import { useLiquitySelector } from "@liquity/lib-react";

const TABS = [
  { tab: "deposit", content: "Deposit" },
  { tab: "withdraw", content: "Withdraw" },
  { tab: "redemption", content: "Redemption" }
];

const select = ({ collateralSurplusBalance }) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

const TroveScreen = () => {
  const [activeTab, setActiveTab] = useState("deposit");
  const { dispatchEvent, view } = useTroveView();

  const { hasSurplusCollateral } = useLiquitySelector(select);

  return (
    <>
      <TroveHead view={view} dispatchEvent={dispatchEvent} />

      {!hasSurplusCollateral && (
        <Tabs activeTab={activeTab} tabs={TABS} setActiveTab={setActiveTab} />
      )}

      {hasSurplusCollateral ? (
        <SurplusAction />
      ) : activeTab === "redemption" ? (
        <Redemption />
      ) : (
        <TroveWidget activeTab={activeTab} view={view} dispatchEvent={dispatchEvent} />
      )}
    </>
  );
};

export default TroveScreen;
