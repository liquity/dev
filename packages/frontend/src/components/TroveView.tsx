import React from "react";
import { Text, Heading } from "rimble-ui";

import { Trove } from "@liquity/lib";
import { useTroveState } from "../hooks/Liquity";

type TroveViewProps = {
  trove: Trove;
};

export const TroveView: React.FC<TroveViewProps> = ({ trove }) => (
  <>
    <Text fontSize={4}>Collateral: {trove.collateral.toString()}</Text>
    <Text fontSize={4}>Debt: {trove.debt.toString()}</Text>
  </>
);

export const CurrentTrove: React.FC = () => {
  const troveState = useTroveState();

  if (!troveState) {
    return null;
  } else if (troveState.type === "loading") {
    return <Text>Loading...</Text>;
  } else {
    if (troveState.result) {
      return (
        <>
          <Heading>Your Liquity Trove</Heading>
          <TroveView trove={troveState.result} />
        </>
      );
    } else {
      return <Text fontSize={5}>You don't have a Liquity Trove</Text>;
    }
  }
};
