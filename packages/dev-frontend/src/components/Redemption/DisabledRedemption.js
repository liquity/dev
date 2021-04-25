import ErrorDescription from "../ErrorDescription";

import classes from "./Redemption.module.css";

export const DisabledRedemption = ({ disabledDays, unlockDate }) => (
  <div className={classes.wrapper}>
    <ErrorDescription>Redemption is not enabled yet.</ErrorDescription>

    <p className={classes.sentence}>
      LUSD redemption is disabled for the first {disabledDays} days after launch.
    </p>

    <p className={classes.sentence}>
      It will be unlocked at <span className={classes.bold}>{unlockDate.toLocaleString()}</span>.
    </p>
  </div>
);
