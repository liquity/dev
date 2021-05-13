import { useState } from "react";

import { useLiquity } from "../../hooks/LiquityContext";

import { Transaction } from "./../Transaction";
import Button from "./../Button";

import classes from "./LiquidationManager.module.css";

export const LiquidationManager = () => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const [numberOfTrovesToLiquidate, setNumberOfTrovesToLiquidate] = useState("90");

  return (
    <div className={classes.wrapper}>
      <h3 className={classes.header}>Liquidate</h3>

      <div className={classes.inputWrapper}>
        <input
          className={classes.input}
          type="number"
          min="1"
          step="1"
          value={numberOfTrovesToLiquidate}
          onChange={e => setNumberOfTrovesToLiquidate(e.target.value)}
        />
        <p className={classes.inputContent}>troves</p>
      </div>

      <Transaction
        id="batch-liquidate"
        tooltip="Liquidate"
        tooltipPlacement="bottom"
        send={overrides => {
          if (!numberOfTrovesToLiquidate) {
            throw new Error("Invalid number");
          }
          return liquity.liquidateUpTo(parseInt(numberOfTrovesToLiquidate, 10), overrides);
        }}
      >
        <Button secondary uppercase className={classes.button}>
          OK
        </Button>
      </Transaction>
    </div>
  );
};
