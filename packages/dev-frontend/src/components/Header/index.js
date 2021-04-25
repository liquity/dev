import Nav from "../Nav";

import classes from "./Header.module.css";

const Header = ({ children }) => {
  return (
    <div className={classes.wrapper}>
      <div className={classes.logo}>LL</div>

      <Nav />

      {children}
    </div>
  );
};

export default Header;
