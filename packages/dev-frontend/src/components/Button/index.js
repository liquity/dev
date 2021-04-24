import cn from "classnames";

import classes from "./Button.module.css";

const Button = ({
  children,
  className,
  onClick,
  small,
  large,
  medium,
  primary,
  uppercase,
  disabled,
  elevated,
  secondary
}) => {
  return (
    <button
      className={cn(classes.wrapper, className, {
        [classes.small]: small,
        [classes.large]: large,
        [classes.primary]: primary && !disabled,
        [classes.uppercase]: uppercase,
        [classes.disabled]: disabled,
        [classes.medium]: medium,
        [classes.elevated]: elevated,
        [classes.secondary]: secondary
      })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
