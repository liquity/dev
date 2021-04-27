import { useEffect, useState } from "react";
import { AddressZero } from "@ethersproject/constants";

import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";

import { UnregisteredFrontend } from "./UnregisteredFrontend";
import { FrontendRegistration } from "./FrontendRegistration";
import { FrontendRegistrationSuccess } from "./FrontendRegistrationSuccess";
import Trove from "./Trove";

const selectFrontend = ({ frontend }) => frontend;

export const PageSwitcher = () => {
  const {
    account,
    config: { frontendTag }
  } = useLiquity();

  const frontend = useLiquitySelector(selectFrontend);
  const unregistered = frontendTag !== AddressZero && frontend.status === "unregistered";

  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (unregistered) {
      setRegistering(true);
    }
  }, [unregistered]);

  if (registering || unregistered) {
    if (frontend.status === "registered") {
      return <FrontendRegistrationSuccess onDismiss={() => setRegistering(false)} />;
    } else if (account === frontendTag) {
      return <FrontendRegistration />;
    } else {
      return <UnregisteredFrontend />;
    }
  } else {
    return <Trove />;
  }
};
