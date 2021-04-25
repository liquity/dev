import classes from "./Footer.module.css";

const Footer = () => (
  <footer className={classes.wrapper}>
    <div className={classes.links}>
      <a className={classes.link} target="_blank" rel="noreferrer" href="https://docs.liquity.org/">
        <ion-icon name="document-text-outline"></ion-icon>
        <p>doc</p>
      </a>
      <a
        className={classes.link}
        target="_blank"
        rel="noreferrer"
        href="https://twitter.com/LandLiquity"
      >
        <ion-icon name="logo-twitter"></ion-icon>
        <p>twitter</p>
      </a>
      <a
        className={classes.link}
        target="_blank"
        rel="noreferrer"
        href="https://discord.com/invite/wAWuxAuD"
      >
        <ion-icon name="logo-discord"></ion-icon>
        <p>discord</p>
      </a>
    </div>
    <div className={classes.email}>team@liquityland.com</div>
    <div className={classes.version}>v1.0.4</div>
  </footer>
);

export default Footer;
