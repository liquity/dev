import React from "react";
import Popup from "reactjs-popup";

const placement2position = {
  top: "top center",
  bottom: "bottom center",
  left: "left center",
  right: "right center"
} as const;

type TooltipProps = {
  children: JSX.Element;
  message: string;
  placement?: keyof typeof placement2position;
};

export const Tooltip: React.FC<TooltipProps> = ({ children, message, placement = "top" }) => (
  <Popup trigger={children} on="hover" position={placement2position[placement]}>
    <>{message}</>
  </Popup>
);
