import { shortenAddress } from "../utils/shortenAddress";
import { useLiquity } from "../hooks/LiquityContext";

import Modal from "../components/Modal";

export const UnregisteredFrontend = () => {
  const {
    config: { frontendTag }
  } = useLiquity();

  return (
    <Modal
      status="error"
      title="Frontend not yet registered"
      content={`If you're the operator of this frontend, please select ${shortenAddress(
        frontendTag
      )} in your wallet to proceed with the registration.`}
    />
  );
};
