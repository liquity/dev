import React from "react";
import { library, IconName, IconProp } from "@fortawesome/fontawesome-svg-core";
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

const getIcon = (name: IconName): IconProp => {
  switch (name) {
    case "clipboard":
      return ["far", "clipboard"];
    default:
      return name;
  }
};

export type IconProps = Pick<FontAwesomeIconProps, "size" | "color" | "spin"> & {
  name: IconName;
};

export const Icon: React.FC<IconProps> = ({ name, ...rest }) => (
  <FontAwesomeIcon icon={getIcon(name)} {...rest} />
);
