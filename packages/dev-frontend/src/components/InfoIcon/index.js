import Tippy from "@tippyjs/react";
import { Ionicon } from "../IonIcon";

import classes from "./InfoIcon.module.css";

export const InfoIcon = ({ placement = "right", tooltip }) => {
  return (
    <Tippy
      className={classes.wrapper}
      interactive={true}
      placement={placement}
      content={tooltip}
      maxWidth="268px"
    >
      <span style={{ display: "inline-flex", color: "var(--gray)" }}>
        &nbsp;
        <Ionicon name="help-circle-outline" />
      </span>
    </Tippy>
  );
};
