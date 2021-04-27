import { useRef, useState } from "react";
import cn from "classnames";

import Button from "../Button";
import Row from "../Row";

import classes from "./Input.module.css";

export const ContentRight = ({ onChange, maxAmount, maxedOut, icon, unit, available }) => (
  <div
    className={cn(classes.contentRight, {
      [classes.contentRightNoInfo]: !available
    })}
  >
    {available && <div className={classes.contentRightAvailable}>{available}</div>}
    <div className={classes.contentRightBottom}>
      {maxAmount && (
        <Button
          small
          primary
          className={classes.contentRightButton}
          onClick={event => {
            event.stopPropagation();
            onChange(maxAmount);
          }}
          disabled={maxedOut}
        >
          max
        </Button>
      )}
      <div className={classes.contentRightValues}>
        {icon && <img src={icon} alt={unit} className={classes.contentRightIcon} />}
        {unit && <p className={classes.contentRightCurrency}>{unit}</p>}
      </div>
    </div>
  </div>
);

const Input = ({ label, unit, maxAmount, maxedOut, icon = "", available, onChange, ...rest }) => {
  const [focused, setFocused] = useState(false);
  const el = useRef(null);

  return (
    <Row label={label} unit={unit} onClick={() => el.current.focus()} className={classes.row}>
      <div
        className={cn(classes.wrapper, {
          [classes.focused]: focused
        })}
      >
        <input
          className={classes.input}
          ref={el}
          type="number"
          onClick={e => e.stopPropagation()}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        <ContentRight
          onChange={onChange}
          maxAmount={maxAmount}
          maxedOut={maxedOut}
          unit={unit}
          icon={icon}
          available={available}
        />
      </div>
    </Row>
  );
};

export default Input;
