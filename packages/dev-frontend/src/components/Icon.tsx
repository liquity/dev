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
  faCheck,
  faPlug,
  faExclamationCircle,
  faAngleUp,
  faAngleDoubleUp,
  faAngleDown,
  faAngleDoubleDown,
  faPen,
  faHandPaper,
  faHeartbeat,
  faBars,
  faArrowDown
} from "@fortawesome/free-solid-svg-icons";
import { faClipboard, faQuestionCircle } from "@fortawesome/free-regular-svg-icons";
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
  faCog,
  faPlug,
  faExclamationCircle,
  faAngleUp,
  faAngleDoubleUp,
  faAngleDown,
  faAngleDoubleDown,
  faPen,
  faHandPaper,
  faHeartbeat,
  faBars,
  faQuestionCircle,
  faArrowDown
);

const getIcon = (name: IconName): IconProp => {
  switch (name) {
    case "clipboard":
      return ["far", "clipboard"];
    case "question-circle":
      return ["far", "question-circle"];
    default:
      return name;
  }
};

export type IconProps = Pick<FontAwesomeIconProps, "style" | "size" | "color" | "spin"> & {
  name: IconName;
};

export const Icon: React.FC<IconProps> = ({ name, style, ...rest }) => (
  <FontAwesomeIcon style={style} icon={getIcon(name)} {...rest} />
);
