import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../../hooks/LiquityContext";
import { AddressZero } from "@ethersproject/constants";

import classes from "./KickbackRate.module.css";

const select = ({ frontend }) => ({
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const UnregisteredKickbackRate = () => (
  <div className={classes.wrapper}>
    <div className={classes.value}>{99}%</div>
    <div className={classes.text}>KICKBACK RATE</div>
  </div>
);

const KickbackRate = () => {
  const { kickbackRate } = useLiquitySelector(select);

  const {
    liquity: {
      connection: { frontendTag }
    }
  } = useLiquity();

  const kickbackRatePct = frontendTag === AddressZero ? "99" : kickbackRate?.mul(100).prettify();

  if (!kickbackRatePct) return null;

  return (
    <div className={classes.wrapper}>
      <h1 className={classes.value}>{kickbackRatePct}%</h1>
      <h2 className={classes.text}>KICKBACK RATE</h2>
    </div>
  );
};

export default KickbackRate;
