// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";

import fetch from "node-fetch";
import { configure } from "@testing-library/dom";
import { DisposableWalletProvider } from "./testUtils/DisposableWalletProvider";

// Loading the Liquity store takes longer without Multicall
configure({ asyncUtilTimeout: 5000 });

const ethereum = new DisposableWalletProvider(
  "http://localhost:8545",
  "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7"
);

// Let web3-react's InjectedConnector find our DisposableWalletProvider
Object.assign(window, { ethereum });

window.fetch = fetch as typeof window.fetch; // node-fetch is not perfectly compliant...
