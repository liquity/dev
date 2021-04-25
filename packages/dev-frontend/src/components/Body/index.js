import classes from "./Body.module.css";

import Footer from "../Footer";

const Body = ({ children }) => (
  <div className={classes.wrapper}>
    <div
      className={classes.background}
      style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/background.jpg)` }}
    />
    <div className={classes.children}>{children}</div>
    <Footer />
  </div>
);

export default Body;
