import React from "react";
import Tippy, { TippyProps } from "@tippyjs/react";
import { Icon } from "./Icon";

export type InfoIconProps = Pick<TippyProps, "placement"> & {
  tooltip: React.ReactNode;
};

export const InfoIcon: React.FC<InfoIconProps> = ({ placement = "right", tooltip }) => {
  return (
    <Tippy interactive={true} placement={placement} content={tooltip}>
      <span>
        &nbsp;
        <Icon name="info-circle" size="1x" />
      </span>
    </Tippy>
  );
};
