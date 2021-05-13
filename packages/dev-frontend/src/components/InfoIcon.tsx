import React from "react";
import Tippy, { TippyProps } from "@tippyjs/react";
import { Ionicon } from "./IonIcon";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import classes from "./InfoIcon.module.css";

export type InfoIconProps = Pick<TippyProps, "placement"> &
  Pick<FontAwesomeIconProps, "size"> & {
    tooltip: React.ReactNode;
  };

export const InfoIcon: React.FC<InfoIconProps> = ({ placement = "right", tooltip, size = "1x" }) => {
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
