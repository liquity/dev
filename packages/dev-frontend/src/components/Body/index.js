import classes from "./Body.module.css";

const Body = ({ children }) => (
  <div className={classes.wrapper}>
    <div
      className={classes.background}
      style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/background.jpg)` }}
    />
    {children}
  </div>
);

export default Body;
