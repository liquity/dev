import classes from "./Loader.module.css";

export const Spinner = ({ size = 9 }) => (
  <div className={classes.loader} style={{ fontSize: size + "rem" }}></div>
);

const Loader = () => (
  <div className={classes.overlay}>
    <div className={classes.loader}></div>
  </div>
);

export default Loader;
