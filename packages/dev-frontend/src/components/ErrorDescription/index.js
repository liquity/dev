import classes from "./ErrorDescription.module.css";

const ErrorDescription = ({ children }) => <p className={classes.wrapper}>{children}</p>;

export default ErrorDescription;
