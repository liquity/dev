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
  faBars,
  faSquare,
  faColumns,
  faArrowRight
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon, FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import { Box, SxProps } from "theme-ui";

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
  faArrowRight,
  faExternalLinkAlt,
  faBars,
  faSquare,
  faColumns
);

export type IconProps = Pick<FontAwesomeIconProps, "size" | "color" | "spin" | "fixedWidth"> & {
  name: IconName;
};

export const Icon: React.FC<IconProps> = ({ name, ...rest }) => (
  <FontAwesomeIcon icon={name} {...rest} />
);

export const UserIcon: React.FC<SxProps> = ({ sx }) => (
  <Box as="span" aria-label="Connected wallet" sx={{ height: "1em", ...sx }}>
    <FontAwesomeIcon icon="user" />
  </Box>
);

const walletIconTranslation = "right-4 down-8";

export const UserWalletIcon: React.FC<SxProps> = ({ sx }) => (
  <Box
    as="span"
    className="fa-layers fa-fw"
    aria-label="Connected wallet"
    sx={{ height: "1em", ...sx }}
  >
    <FontAwesomeIcon icon="square" mask="user" transform={`shrink-5 ${walletIconTranslation}`} />

    <Box as="span" sx={{ color: "accent" }}>
      <FontAwesomeIcon icon="wallet" transform={`shrink-7.5 ${walletIconTranslation}`} />
    </Box>
  </Box>
);

export const InfoPaneIcon: React.FC<SxProps> = ({ sx }) => (
  <Box
    as="span"
    className="fa-layers fa-fw"
    aria-label="Close right pane"
    sx={{ height: "1em", ...sx }}
  >
    <FontAwesomeIcon icon="columns" />
    <FontAwesomeIcon icon="info" transform="shrink-10 right-3.3 down-1" />
  </Box>
);
