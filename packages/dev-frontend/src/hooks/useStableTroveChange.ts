import { useEffect, useState } from "react";
import { Decimal, TroveChange } from "@stabilio/lib-base";

type ValidTroveChange = Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;

const paramsEq = (a?: Decimal, b?: Decimal) => (a && b ? a.eq(b) : !a && !b);

const equals = (a: ValidTroveChange, b: ValidTroveChange): boolean => {
  return (
    a.type === b.type &&
    paramsEq(a.params.borrowXBRL, b.params.borrowXBRL) &&
    paramsEq(a.params.repayXBRL, b.params.repayXBRL) &&
    paramsEq(a.params.depositCollateral, b.params.depositCollateral) &&
    paramsEq(a.params.withdrawCollateral, b.params.withdrawCollateral)
  );
};

export const useStableTroveChange = (
  troveChange: ValidTroveChange | undefined
): ValidTroveChange | undefined => {
  const [stableTroveChange, setStableTroveChange] = useState(troveChange);

  useEffect(() => {
    if (!!stableTroveChange !== !!troveChange) {
      setStableTroveChange(troveChange);
    } else if (stableTroveChange && troveChange && !equals(stableTroveChange, troveChange)) {
      setStableTroveChange(troveChange);
    }
  }, [stableTroveChange, troveChange]);

  return stableTroveChange;
};
