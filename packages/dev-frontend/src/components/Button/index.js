import cn from "classnames";

import classes from "./Button.module.css";

const Button = ({
  children,
  className,
  onClick,
  small,
  xs,
  large,
  medium,
  primary,
  uppercase,
  disabled,
  elevated,
  secondary,
  tertiary
}) => {
  return (
    <button
      className={cn(classes.wrapper, className, {
        [classes.small]: small,
        [classes.xs]: xs,
        [classes.large]: large,
        [classes.primary]: primary,
        [classes.uppercase]: uppercase,
        [classes.disabled]: disabled,
        [classes.medium]: medium,
        [classes.elevated]: elevated,
        [classes.secondary]: secondary,
        [classes.tertiary]: tertiary
      })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
