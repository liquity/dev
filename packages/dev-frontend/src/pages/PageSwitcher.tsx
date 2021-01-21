import { useEffect, useState } from "react";
import { AddressZero } from "@ethersproject/constants";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";

import { Dashboard } from "./Dashboard";
import { UnregisteredFrontend } from "./UnregisteredFrontend";
import { FrontendRegistration } from "./FrontendRegistration";
import { FrontendRegistrationSuccess } from "./FrontendRegistrationSuccess";

const select = ({ frontend, frontendTag }: LiquityStoreState) => ({
  frontend,
  frontendTag
});

export const PageSwitcher: React.FC = () => {
  const { account } = useLiquity();
  const { frontend, frontendTag } = useLiquitySelector(select);
  const [registering, setRegistering] = useState(false);

  const unregistered = frontendTag !== AddressZero && frontend.status === "unregistered";

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
    return <Dashboard />;
  }
};
