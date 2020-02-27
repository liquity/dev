import React from "react";
import { Image } from "rimble-ui";

import metaMaskIcon from "../images/MetaMaskIcon.svg";

export const MetaMaskIcon: React.FC = () => (
  <Image src={metaMaskIcon} aria-label="MetaMask extension icon" size="24px" />
);
