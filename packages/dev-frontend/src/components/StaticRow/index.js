import cn from "classnames";

import classes from "./StaticRow.module.css";

const StaticRow = ({
  label,
  amount,
  color,
  className,
  unit,
  oldAmount,
  oldColor,
  brackets,
  boldAmount,
  boldLabel,
  labelColor
}) => (
  <div className={cn(classes.staticRow, className)}>
    <p
      className={cn(classes.staticRowlabel, {
        [classes.boldAmount]: boldLabel,
        [classes.labelPrimary]: labelColor === "primary"
      })}
    >
      {label}
    </p>
    <p className={cn(classes.staticRowAmount, classes[color])}>
      {oldAmount && <span className={classes[oldColor]}>{oldAmount}</span>}
      {oldAmount && <span> &#8594;</span>}{" "}
      <span className={cn({ [classes.boldAmount]: boldAmount })}>{amount}</span> {unit}{" "}
      {brackets && `(${brackets})`}
    </p>
  </div>
);

export default StaticRow;
