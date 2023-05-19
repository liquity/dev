import { ConnectKitButton } from "connectkit";

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

export const WalletConnector: React.FC<WalletConnectorProps> = () => {
  return <ConnectKitButton />;
};
