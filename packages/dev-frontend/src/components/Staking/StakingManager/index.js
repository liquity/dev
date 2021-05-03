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

const selectLQTYBalance = ({ lqtyBalance, lusdInStabilityPool }) => ({
  lqtyBalance,
  lusdInStabilityPool
});

const Head = ({ total, title }) => {
  return (
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>total staked {total.div(1000).prettify(0)}k</p>
        <p className={classes.totalAPR}>APR 25%</p>
      </div>
      <h3 className={classes.title}>{title}</h3>
    </div>
  );
};

const StakingManager = () => {
  const [{ originalStake, editedLQTY }, dispatch] = useLiquityReducer(reduce, init);
  const { lusdInStabilityPool } = useLiquitySelector(selectLQTYBalance);
  const [modal, setModal] = useState(null);
  const { view, dispatch: dispatchView } = useStakingView();

  return (
    <>
      <Head
        total={lusdInStabilityPool}
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

//<Button variant="cancel" onClick={() => dispatchStakingViewAction({ type: ////"cancelAdjusting" })}>
//  Cancel
//</Button>;

//{
//  validChange ? (
//    <StakingManagerAction change={validChange}>Confirm</StakingManagerAction>
//  ) : (
//    <Button disabled>Confirm</Button>
//  );
//}

// const StakingManagerActionDescription = ({ originalStake, change }) => {
//   const stakeLQTY = change.stakeLQTY?.prettify().concat(" ", GT);
//   const unstakeLQTY = change.unstakeLQTY?.prettify().concat(" ", GT);
//   const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" ETH");
//   const lusdGain = originalStake.lusdGain.nonZero?.prettify().concat(" ", COIN);

//   if (originalStake.isEmpty && stakeLQTY) {
//     return (
//       <ActionDescription>
//         You are staking <Amount>{stakeLQTY}</Amount>.
//       </ActionDescription>
//     );
//   }

//   return (
//     <ActionDescription>
//       {stakeLQTY && (
//         <>
//           You are adding <Amount>{stakeLQTY}</Amount> to your stake
//         </>
//       )}
//       {unstakeLQTY && (
//         <>
//           You are withdrawing <Amount>{unstakeLQTY}</Amount> to your wallet
//         </>
//       )}
//       {(collateralGain || lusdGain) && (
//         <>
//           {" "}
//           and claiming{" "}
//           {collateralGain && lusdGain ? (
//             <>
//               <Amount>{collateralGain}</Amount> and <Amount>{lusdGain}</Amount>
//             </>
//           ) : (
//             <>
//               <Amount>{collateralGain ?? lusdGain}</Amount>
//             </>
//           )}
//         </>
//       )}
//       .
//     </ActionDescription>
//   );
// };
