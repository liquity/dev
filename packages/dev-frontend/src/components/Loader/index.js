import classes from "./Loader.module.css";

const Loader = () => (
  <div className={classes.overlay}>
    <div className={classes.loader}></div>
  </div>
);

export default Loader;
