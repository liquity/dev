import { useState } from "react";

import { Decimal } from "@liquity/lib-base";

import { useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import StakingEditor from "./../StakingEditor";
import { useStakingView } from "../context/StakingViewContext";

import classes from "./StakingManager.module.css";

const init = ({ lqtyStake }) => ({
  originalStake: lqtyStake,
  editedLQTY: lqtyStake.stakedLQTY
});

const reduce = (state, action) => {
  const { originalStake, editedLQTY } = state;

  switch (action.type) {
    case "setStake": {
      const newStake = originalStake.stakedLQTY.add(Decimal.from(action.newValue || 0));
      return { ...state, editedLQTY: newStake };
    }

    case "decrement": {
      const newStake = Decimal.from(action.newValue || 0).gt(originalStake.stakedLQTY)
        ? Decimal.ZERO
        : originalStake.stakedLQTY.sub(Decimal.from(action.newValue || 0));
      return { ...state, editedLQTY: newStake };
    }

    case "increment": {
      const newStake = originalStake.stakedLQTY.add(Decimal.from(action.newValue || 0));
      return { ...state, editedLQTY: newStake };
    }

    case "revert":
      return { ...state, editedLQTY: originalStake.stakedLQTY };

    case "updateStore": {
      const {
        stateChange: { lqtyStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedLQTY: updatedStake.apply(originalStake.whatChanged(editedLQTY))
        };
      }
      return state;
    }
    default:
      return state;
  }
};

const selectLQTYBalance = ({ totalStakedLQTY }) => ({
  totalStakedLQTY
});

const Head = ({ total, title }) => {
  return (
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>total staked {total.shorten()}</p>
      </div>
      <h3 className={classes.title}>{title}</h3>
    </div>
  );
};

const StakingManager = () => {
  const [{ originalStake, editedLQTY }, dispatch] = useLiquityReducer(reduce, init);
  const { totalStakedLQTY } = useLiquitySelector(selectLQTYBalance);
  const [modal, setModal] = useState(null);
  const { view, dispatch: dispatchView } = useStakingView();

  return (
    <>
      <Head
        total={totalStakedLQTY}
        title="Stake LQTY to earn a share of borrowing and redemption fees"
      />
      <StakingEditor
        title={"Staking"}
        originalStake={originalStake}
        editedLQTY={editedLQTY}
        dispatch={dispatch}
        modal={modal}
        setModal={setModal}
        view={view}
        dispatchView={dispatchView}
      />
    </>
  );
};

export default StakingManager;
