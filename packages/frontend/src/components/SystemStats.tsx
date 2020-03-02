import React, { useCallback } from "react";
import { Text } from "rimble-ui";

import { Liquity } from "@liquity/lib";
import { useAsyncValue } from "../hooks/AsyncValue";

type SystemStatsProps = {
  liquity: Liquity;
};

export const SystemStats: React.FC<SystemStatsProps> = ({ liquity }) => {
  const numberOfTrovesState = useAsyncValue(
    useCallback(() => liquity.getNumberOfTroves(), [liquity])
  );

  if (!numberOfTrovesState.loaded) {
    return null;
  }

  const numberOfTroves = numberOfTrovesState.value.toString();

  return <Text>Total number of Liquity Troves: {numberOfTroves}</Text>;
};
