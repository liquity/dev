import React from "react";
import { Text, Heading } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { useTroveState } from "../hooks/Liquity";

type TroveViewProps = {
  trove: Trove;
};

export const TroveView: React.FC<TroveViewProps> = ({ trove }) => (
  <>
    <Text fontSize={4}>Collateral: {trove.collateral.toString(2)} ETH</Text>
    <Text fontSize={4}>Debt: {trove.debt.toString(2)} QUI</Text>
  </>
);

type CurrentTroveProps = {
  liquity: Liquity;
};

export const CurrentTrove: React.FC<CurrentTroveProps> = ({ liquity }) => {
  const troveState = useTroveState(liquity);

  if (troveState.type === "loading") {
    return <Text>Loading...</Text>;
  }

  const trove = troveState.value;
  if (!trove) {
    return <Text fontSize={5}>You don't have a Liquity Trove yet</Text>;
  }

  return (
    <>
      <Heading>Your Liquity Trove</Heading>
      <TroveView trove={trove} />
    </>
  );
};
