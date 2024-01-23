import React from "react";
import { Icon } from "./Icon";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import { Tooltip } from "./Tooltip";
import type { TooltipProps } from "./Tooltip";

export type InfoIconProps = Pick<TooltipProps, "placement" | "link"> &
  Pick<FontAwesomeIconProps, "size"> & {
    tooltip: React.ReactNode;
  };

export const InfoIcon: React.FC<InfoIconProps> = ({
  link,
  placement = "right",
  tooltip,
  size = "1x"
}) => {
  return (
    <Tooltip message={tooltip} placement={placement} link={link}>
      &nbsp;
      <Icon name="question-circle" size={size} />
    </Tooltip>
  );
};
