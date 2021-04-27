import classes from "./Loader.module.css";

export const Spinner = ({ size = 9 }) => (
  <div className={classes["loadingio-spinner-dual-ball-ax6i0pabift"]}>
    <div className={classes["ldio-79y8aqou92d"]}>
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
);

const Loader = () => <div className={classes.overlay}></div>;

export default Loader;
