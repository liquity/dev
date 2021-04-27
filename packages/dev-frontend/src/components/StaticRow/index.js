import cn from "classnames";

import classes from "./StaticRow.module.css";

const StaticRow = ({ label, amount, color, className, unit, oldAmount, oldColor, brackets }) => (
  <div className={cn(classes.staticRow, className)}>
    <p className={classes.staticRowlabel}>{label}</p>
    <p className={cn(classes.staticRowAmount, classes[color])}>
      {oldAmount && <span className={classes[oldColor]}>{oldAmount}</span>}
      {oldAmount && <span> &#8594;</span>} {amount} {unit} {brackets && `(${brackets})`}
    </p>
  </div>
);

export default StaticRow;
