import React from "react";
import { Flex } from "theme-ui";
import Tippy, { TippyProps } from "@tippyjs/react";
import { Icon } from "./Icon";

export type InfoIconProps = Pick<TippyProps, "placement"> & {
  tooltip: React.ReactNode;
};

export const InfoIcon: React.FC<InfoIconProps> = ({ placement = "right", tooltip }) => {
  return (
    <Flex sx={{ minWidth: "100px", maxWidth: "148px" }}>
      <Tippy interactive={true} placement={placement} content={tooltip}>
        <span>
          &nbsp;
          <Icon name="info-circle" size="1x" />
        </span>
      </Tippy>
    </Flex>
  );
};
