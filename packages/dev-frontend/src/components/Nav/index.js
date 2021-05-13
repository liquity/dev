import Link from "../Link";
import Button from "../Button";

import classes from "./Nav.module.css";

const LINKS = [
  { to: "/", content: "Trove" },
  { to: "/stability-pool", content: "Stability Pool" },
  { to: "/stake", content: "Stake" },
  { to: "/liquidation", content: "Liquidation" },
  { href: "https://duneanalytics.com/dani/Liquity", content: "Liquity analitics" }
];

const Nav = () => {
  return (
    <div className={classes.wrapper}>
      <div className={classes.brand}>
        <Link to="/">
          <span className={classes.brandName}>Liquity Land</span>
          <span className={classes.description}>The most simple front-end</span>
        </Link>
      </div>

      <div className={classes.items}>
        {LINKS.map((l, i) => (
          <Link
            to={l.to}
            href={l.href}
            key={i}
            className={classes.link}
            activeClassName={classes.linkActive}
          >
            {l.content}
          </Link>
        ))}
      </div>

      <div className={classes.config}>
        <Button className={classes.languageChange}>
          <span className={classes.lang}>EN</span>
          <span className={classes.langIcon}>
            <ion-icon name="globe-outline"></ion-icon>
          </span>
        </Button>
      </div>
    </div>
  );
};

export default Nav;
