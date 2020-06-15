import React from "react";
import { Image } from "theme-ui";

import metaMaskIcon from "../images/MetaMaskIcon.svg";

export const MetaMaskIcon: React.FC = () => (
  <Image
    src={metaMaskIcon}
    aria-label="MetaMask extension icon"
    sx={{ width: "24px", height: "24px" }}
  />
);
