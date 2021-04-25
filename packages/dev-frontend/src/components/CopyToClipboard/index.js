import { useState } from "react";
import cn from "classnames";

import Tooltip from "../Tooltip";

import classes from "./CopyToClipboard.module.css";

const copyToClipboard = str => {
  const el = document.createElement("textarea");
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
};

const CopyToClipboard = ({ children, className, text }) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    setCopied(true);
    copyToClipboard(text);
  };

  return (
    <div
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => {
        setShowTooltip(false);
        setCopied(false);
      }}
      onClick={handleClick}
      className={cn(classes.wrapper, className)}
    >
      {children}
      {showTooltip && <Tooltip>{copied ? "Copied" : "Copy to clipboard"}</Tooltip>}
    </div>
  );
};

export default CopyToClipboard;
