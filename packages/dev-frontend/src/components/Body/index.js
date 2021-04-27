import classes from "./Body.module.css";

<<<<<<< HEAD
=======
import Footer from "../Footer";

>>>>>>> feat/trove-page
const Body = ({ children }) => (
  <div className={classes.wrapper}>
    <div
      className={classes.background}
      style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/background.jpg)` }}
    />
<<<<<<< HEAD
    {children}
=======
    <div className={classes.children}>{children}</div>
    <Footer />
>>>>>>> feat/trove-page
  </div>
);

export default Body;
