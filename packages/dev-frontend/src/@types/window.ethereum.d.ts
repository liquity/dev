declare interface Window {
  location: string;
  opera: any
  parent?: Window;
  ethereum?: {
    isMetaMask?: boolean;
  };
}
