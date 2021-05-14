import { useState } from "react";
import { Decimal, Percent } from "@liquity/lib-base";

import Row from "../../../components/Row";
import StaticAmounts from "../../../components/StaticAmounts";
import Tabs from "../../../components/Tabs";
import Button from "../../../components/Button";
import ErrorDescription from "../../../components/ErrorDescription";
import { ContentRight } from "../../../components/Input";
import StaticRow from "../../../components/StaticRow";
import CopyToClipboard from "../../../components/CopyToClipboard";
import { shortenAddress } from "../../../utils/shortenAddress";

import { ETH, COIN, GT, LP } from "../../../strings";

import classes from "./Preview.module.css";
import liqClasses from "../../Liquidation/Liquidation.module.css";
import liqManClasses from "../../../components/LiquidationManager/LiquidationManager.module.css";

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

export const TrovePreview = ({ showModal }) => {
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

export const StabilityPrevies = ({ showModal }) => {
  return (
    <div className={classes.wrapper}>
      <Tabs
        activeTab={"stake"}
        setActiveTab={() => {}}
        tabs={[{ tab: "stake", content: "STAKE LUSD" }]}
      />

      <div className={classes.head}>
        <div className={classes.total}>
          <p className={classes.totalStaked}>total staked --</p>
        </div>
        <h3 className={classes.title}>Earn ETH and liquity by depositing LUSD</h3>
      </div>

      <div className={classes.staticInfo}>
        <StaticRow label="Pool share" amount="N/A" />

        <StaticRow label="Liquidation gain" amount={Decimal.ZERO.prettify(4)} unit="ETH" />

        <StaticRow label="Reward" amount={Decimal.ZERO.prettify(2)} unit={GT} />
      </div>

      <div className={classes.stakedWrapper}>
        <StaticRow
          labelColor="primary"
          label="Staked"
          amount={Decimal.ZERO.prettify(2)}
          unit={COIN}
        />
      </div>

      <ErrorDescription>
        Please connect your wallet first before using our services.
      </ErrorDescription>

      <div className={classes.action}>
        <Button large primary round onClick={showModal}>
          Connect wallet
        </Button>
      </div>
    </div>
  );
};

const STAKING_TABS = [
  { tab: "lqty", content: "Stake LQTY" },
  { tab: "unilp", content: "Stake UNI LP " }
];

const StakeLQTYPReview = () => (
  <>
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>total staked --</p>
      </div>
      <h3 className={classes.title}>Deposit more LQTY to increase pool share.</h3>
    </div>

    <div className={classes.staticInfo}>
      <StaticRow label="Pool share" amount="N/A" />

      <StaticRow label="Redemption gain" amount={Decimal.ZERO.prettify(4)} unit="ETH" />

      <StaticRow label="Issurance gain" amount={Decimal.ZERO.prettify(2)} unit={COIN} />
    </div>

    <div className={classes.stakedWrapper}>
      <StaticRow labelColor="primary" label="Staked" amount={Decimal.ZERO.prettify(2)} unit={GT} />
    </div>
  </>
);

export const StakeUniLPPreview = () => (
  <>
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>total staked --</p>
      </div>
      <h3 className={classes.title}>Deposit more LQTY to increase pool share.</h3>
    </div>

    <div className={classes.staticInfo}>
      <StaticRow label="Pool share" amount="N/A" />

      <StaticRow label="Reward" amount={Decimal.ZERO.prettify(2)} unit={GT} />
    </div>

    <div className={classes.stakedWrapper}>
      <StaticRow labelColor="primary" label="Staked" amount={Decimal.ZERO.prettify(2)} unit={LP} />
    </div>
  </>
);

export const StakingPreview = ({ showModal }) => {
  const [activeTab, setActiveTab] = useState("lqty");

  return (
    <div className={classes.wrapper}>
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={STAKING_TABS} />

      {activeTab === "lqty" && <StakeLQTYPReview />}
      {activeTab === "unilp" && <StakeUniLPPreview />}

      <ErrorDescription>
        Please connect your wallet first before using our services.
      </ErrorDescription>

      <div className={classes.action}>
        <Button large primary round onClick={showModal}>
          Connect wallet
        </Button>
      </div>
    </div>
  );
};

const MOCK_TROVES = new Array(10).fill({
  ownerAddress: "0x0000000000000000000000000000000000000000",
  debt: Decimal.ZERO,
  collateral: Decimal.ZERO
});

export const LiquidationPrevriew = ({ showModal }) => (
  <div className={liqClasses.wrapper}>
    <h1 className={liqClasses.header}>Risky Troves</h1>
    <div className={liqClasses.heading}>
      <div className={liqManClasses.wrapper}>
        <h3 className={liqManClasses.header}>Liquidate</h3>

        <div className={liqManClasses.inputWrapper}>
          <input
            className={liqManClasses.input}
            tiny
            type="number"
            min="1"
            step="1"
            value={90}
            onChange={() => {}}
          />
          <p className={liqManClasses.inputContent}>troves</p>
        </div>

        <Button secondary uppercase className={liqManClasses.button}>
          OK
        </Button>
      </div>

      <p className={liqClasses.pageNum}>1-10 of 109</p>

      <Button className={liqClasses.arrowButton} onClick={() => {}} disabled={true}>
        <ion-icon name="chevron-back-outline"></ion-icon>
      </Button>

      <Button className={liqClasses.arrowButton} onClick={() => {}} disabled={false}>
        <ion-icon name="chevron-forward-outline"></ion-icon>
      </Button>

      <Button onClick={() => {}} className={liqClasses.reloadButton}>
        <ion-icon name="refresh-outline"></ion-icon>
      </Button>
    </div>
    <div className={liqClasses.table}>
      <div className={liqClasses.tableHead}>
        <p className={liqClasses.tableHeadText}>Owner</p>
        <div className={liqClasses.tableHeadBox}>
          <p className={liqClasses.tableHeadText}>Collateral</p>
          <p className={liqClasses.tableHeadUnit}>{ETH}</p>
        </div>
        <div className={liqClasses.tableHeadBox}>
          <p className={liqClasses.tableHeadText}>Debt</p>
          <p className={liqClasses.tableHeadUnit}>{COIN}</p>
        </div>
        <p className={liqClasses.tableHeadText}>
          Collateral
          <br />
          Ratio
        </p>
        <div className={liqClasses.tableHeadBox}>
          <p className={liqClasses.tableHeadText}>
            Liquidation
            <br />
            Price
          </p>
          <p className={liqClasses.tableHeadUnit}>
            {COIN} / {ETH}
          </p>
        </div>
      </div>

      <div className={liqClasses.tableBody}>
        {MOCK_TROVES.map(trove => {
          return (
            <div className={liqClasses.tableRow} key={trove.ownerAddress}>
              <div className={liqClasses.addressData}>
                <p className={liqClasses.address}>{shortenAddress(trove.ownerAddress)}</p>
                <CopyToClipboard className={liqClasses.doButton} text={trove.ownerAddress}>
                  <ion-icon name="copy-outline"></ion-icon>
                </CopyToClipboard>
              </div>

              <p className={liqClasses.tableData}>{trove.collateral.prettify(4)}</p>

              <p className={liqClasses.tableData}>{trove.debt.prettify(2)}</p>

              <p className={liqClasses.tableData}>{new Percent(0).prettify(2)}</p>

              <p className={liqClasses.tableData}>{Decimal.ZERO.prettify(2)}</p>

              <Button className={liqClasses.liquidationButton} onClick={showModal}>
                Liquidate
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
