import classes from "./StabilityPool.module.css";

import StabilityDepositManager from "../../components/Stability/StabilityDepositManager";

const StabilityPool = () => {
  return (
    <>
      <div className={classes.tabs}>
        <div className={classes.tab}>Stake LUSD</div>
      </div>
      <StabilityDepositManager />
    </>
  );
};

export default StabilityPool;
