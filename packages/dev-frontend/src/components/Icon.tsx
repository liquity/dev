import React from "react";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCircleNotch,
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
  faTrash,
  faChartLine,
  faRedo,
  faHistory,
  faChevronLeft,
  faChevronRight,
  faUserCircle,
  faWallet,
  faExternalLinkAlt,
  faClipboardCheck,
  faCog,
  faCheck
} from "@fortawesome/free-solid-svg-icons";
import { faClipboard } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon, FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

library.add(
  faCircleNotch,
  faCheck,
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
  faTrash,
  faChartLine,
  faRedo,
  faHistory,
  faChevronLeft,
  faChevronRight,
  faClipboard,
  faClipboardCheck,
  faUserCircle,
  faWallet,
  faExternalLinkAlt,
  faCog
);

export type IconProps = {
  name: FontAwesomeIconProps["icon"];
  size?: FontAwesomeIconProps["size"];
  color?: FontAwesomeIconProps["color"];
  spin?: FontAwesomeIconProps["spin"];
};

export const Icon: React.FC<IconProps> = ({ name: icon, size, color, spin }) => (
  <FontAwesomeIcon {...{ icon, size, color, spin }} />
);
