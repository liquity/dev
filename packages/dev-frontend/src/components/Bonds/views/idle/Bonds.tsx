/** @jsxImportSource theme-ui */
import React from "react";
import type { Bond as BondType } from "../../context/transitions";
import { useBondView } from "../../context/BondViewContext";
import { Bond } from "./Bond";

export const Bonds: React.FC = () => {
  const { bonds, optimisticBond } = useBondView();

  if (bonds === undefined) return null;

  return (
    <>
      {optimisticBond && <Bond bond={optimisticBond} /*style={{ zIndex: 1 }}*/ />}
      {bonds.map((bond: BondType, idx: number) => {
        return <Bond bond={bond} key={idx} />;
      })}
    </>
  );
};
