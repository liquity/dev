import { useStakingView } from "./context/StakingViewContext";
import { ReadOnlyStake } from "./ReadOnlyStake";
import { StakingManager } from "./StakingManager";
import { NoStake } from "./NoStake";

export const Staking: React.FC = () => {
  const { view } = useStakingView();

  switch (view) {
    case "ACTIVE":
      return <ReadOnlyStake />;

    case "ADJUSTING":
      return <StakingManager />;

    case "NONE":
      return <NoStake />;
  }
};
