import classes from "./Tooltip.module.css";

const Tooltip = ({ children }) => <div className={classes.wrapper}>{children}</div>;

export default Tooltip;
