import classes from "./StaticAmounts.module.css";

const StaticAmounts = ({ labelledBy, unit, onClick, children, placeholder }) => {
  return (
    <div aria-labelledby={labelledBy} onClick={onClick} className={classes.staticAmounts}>
      <div className={classes.staticAmountsContent}>
        <p className={classes.staticAmountsAmount}>{placeholder}</p>

        {unit && (
          <>
            &nbsp;
            <p className={classes.staticAmountsUnit}>{unit}</p>
          </>
        )}
      </div>

      {children}
    </div>
  );
};

export default StaticAmounts;
