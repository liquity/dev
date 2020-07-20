import React from "react";
import { library, IconName } from "@fortawesome/fontawesome-svg-core";
import {
  faRetweet,
  faSeedling,
  faHandsHelping,
  faUser,
  faCaretDown,
  faWallet,
  faPercent,
  faExclamationCircle,
  faUnlock,
  faLock,
  faInfo,
  faSearch,
  faTimes,
  faCircle,
  faArrowLeft,
  faExternalLinkAlt,
  faBars
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon, FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

library.add(
  faHandsHelping,
  faSeedling,
  faRetweet,
  faUser,
  faCaretDown,
  faWallet,
  faPercent,
  faExclamationCircle,
  faUnlock,
  faLock,
  faInfo,
  faSearch,
  faTimes,
  faCircle,
  faArrowLeft,
  faExternalLinkAlt,
  faBars
);

export type IconProps = Pick<FontAwesomeIconProps, "size" | "color" | "spin" | "fixedWidth"> & {
  name: IconName;
};

export const Icon: React.FC<IconProps> = ({ name, ...rest }) => (
  <FontAwesomeIcon icon={name} {...rest} />
);
