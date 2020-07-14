import React from "react";
import { library, IconName } from "@fortawesome/fontawesome-svg-core";
import {
  faRetweet,
  faSeedling,
  faHandsHelping,
  faUserCircle,
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
  faExternalLinkAlt
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon, FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

library.add(
  faHandsHelping,
  faSeedling,
  faRetweet,
  faUserCircle,
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
  faExternalLinkAlt
);

export type IconProps = Pick<FontAwesomeIconProps, "size" | "color" | "spin" | "fixedWidth"> & {
  name: IconName;
};

export const Icon: React.FC<IconProps> = ({ name, ...rest }) => (
  <FontAwesomeIcon icon={name} {...rest} />
);
