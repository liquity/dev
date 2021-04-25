import cn from "classnames";

import classes from "./Row.module.css";

const Row = ({ onClick, label, labelId, labelFor, children, infoIcon, className = "" }) => {
  return (
    <div className={cn(classes.row, className)} onClick={onClick}>
      <div id={labelId} htmlFor={labelFor} className={classes.labelContainer}>
        <div className={classes.label}>
          {label}
          {infoIcon && infoIcon}
        </div>
      </div>
      {children}
    </div>
  );
};

export default Row;
