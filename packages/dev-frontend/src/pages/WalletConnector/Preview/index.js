import { useState } from "react";
import { Decimal } from "@liquity/lib-base";

import Row from "../../../components/Row";
import StaticAmounts from "../../../components/StaticAmounts";
import Tabs from "../../../components/Tabs";
import Button from "../../../components/Button";
import ErrorDescription from "../../../components/ErrorDescription";
import { ContentRight } from "../../../components/Input";

import { ETH, COIN } from "../../../strings";

import classes from "./Preview.module.css";

const TABS = [
  { tab: "deposit", content: "Deposit" },
  { tab: "withdraw", content: "Withdraw" },
  { tab: "redemption", content: "Redemption" }
];

export const WithdrawPreview = ({ onClick, children }) => (
  <>
    <Row label="withdraw" unit={ETH}>
      <StaticAmounts
        onClick={onClick}
        inputId="withdraw"
        placeholder={Decimal.from(0).prettify(4)}
        unit={ETH}
        className={classes.staticAmount}
      >
        <ContentRight unit={ETH} icon={process.env.PUBLIC_URL + "/icons/ethereum-eth.svg"} />
      </StaticAmounts>
    </Row>

    <Row label="repay" unit={ETH}>
      <StaticAmounts
        onClick={onClick}
        placeholder={Decimal.from(0).prettify(4)}
        unit={COIN}
        className={classes.staticAmount}
      >
        <ContentRight unit={COIN} icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"} />
      </StaticAmounts>
    </Row>

    {children}
  </>
);

const DepositPreview = ({ onClick }) => (
  <>
    <Row label="deposit" unit={ETH}>
      <StaticAmounts
        onClick={onClick}
        inputId="trove-collateral"
        placeholder={Decimal.from(0).prettify(4)}
        unit={ETH}
        className={classes.staticAmount}
      >
        <ContentRight unit={ETH} icon={process.env.PUBLIC_URL + "/icons/ethereum-eth.svg"} />
      </StaticAmounts>
    </Row>

    <Row label="borrow" unit={ETH}>
      <StaticAmounts
        onClick={onClick}
        placeholder={Decimal.from(0).prettify(4)}
        unit={COIN}
        className={classes.staticAmount}
      >
        <ContentRight unit={COIN} icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"} />
      </StaticAmounts>
    </Row>
  </>
);

const RedemptionPreview = ({ onClick }) => (
  <Row label="reedem" unit={ETH}>
    <StaticAmounts
      onClick={onClick}
      inputId="reedem"
      placeholder={Decimal.from(0).prettify(4)}
      unit={COIN}
      className={classes.staticAmount}
    >
      <ContentRight unit={COIN} icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"} />
    </StaticAmounts>
  </Row>
);

const Preview = ({ showModal }) => {
  const [showAlert, setShowAlert] = useState(false);
  const [activeTab, setActiveTab] = useState("deposit");

  return (
    <div className={classes.wrapper}>
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} className={classes.tabs} />

      {activeTab === "deposit" && <DepositPreview onClick={() => setShowAlert(true)} />}
      {activeTab === "withdraw" && <WithdrawPreview onClick={() => setShowAlert(true)} />}
      {activeTab === "redemption" && <RedemptionPreview onClick={() => setShowAlert(true)} />}

      {showAlert && (
        <ErrorDescription>
          Please connect your wallet first before using our services.
        </ErrorDescription>
      )}

      <div className={classes.action}>
        <Button large primary round onClick={showModal}>
          Connect wallet
        </Button>
      </div>
    </div>
  );
};

export default Preview;
