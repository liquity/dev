import classes from "./StabilityPool.module.css";

import StabilityDepositManager from "../../components/Stability/StabilityDepositManager";

const Stake = () => {
  return (
    <>
      <div className={classes.tabs}>
        <div className={classes.tab}>STAKE LUSD</div>
      </div>
      <StabilityDepositManager />
    </>
  );
};

export default Stake;
