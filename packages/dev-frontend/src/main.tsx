import React from "react";
import ReactDOM from "react-dom/client";
import Modal from "react-modal";

import "./index.css";
import App from "./App";

Modal.setAppElement("#root");

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
