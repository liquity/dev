import React from "react";
import { Web3Provider } from "ethers/providers";
import { Web3ReactProvider } from '@web3-react/core';

import WalletConnector from "./components/WalletConnector";
import logo from "./logo.svg";
import "./App.css";

const LiquityFrontend = () => (
  <div className="App">
    <header className="App-header">
      <img src={logo} className="App-logo" alt="logo" />
      <WalletConnector />
    </header>
  </div>
);

const App = () => (
  <Web3ReactProvider getLibrary={provider => new Web3Provider(provider)}>
    <LiquityFrontend />
  </Web3ReactProvider>
);

export default App;
