import WalletConnectProvider from "@walletconnect/web3-provider";

//  Create WalletConnect Provider
export const provider = new WalletConnectProvider({
  infuraId: "158b6511a5c74d1ac028a8a2afe8f626"
});

provider.on("accountsChanged", accounts => {
  console.log(accounts);
});

// Subscribe to chainId change
provider.on("chainChanged", chainId => {
  console.log(chainId);
});

// Subscribe to session disconnection
provider.on("disconnect", (code, reason) => {
  console.log(code, reason);
});
