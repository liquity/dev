import { useParams } from "react-router-dom";
import { useBondView } from "../../context/BondViewContext";
import type { BondStatus, Bond as BondType } from "../../context/transitions";
import { Bond } from "./Bond";
import { OptimisticBond } from "./OptimisticBond";
import { ActionDescription } from "../../../ActionDescription";
import { Box } from "theme-ui";

type BondFilter = "pending" | "claimed" | "cancelled";

const bondFilterToBondStatusMap: Record<BondFilter, BondStatus> = {
  pending: "PENDING",
  claimed: "CLAIMED",
  cancelled: "CANCELLED"
};

const getFilteredBonds = (bonds: BondType[], bondFilter: BondFilter) =>
  bonds.filter(bond => bond.status === bondFilterToBondStatusMap[bondFilter]);

type FilteredBondsParams = { bondFilter: BondFilter | "all" };

export const FilteredBondList = () => {
  const { bonds, optimisticBond } = useBondView();
  const { bondFilter } = useParams<FilteredBondsParams>();

  if (bonds === undefined) return null;

  const isAllOrPending = bondFilter === "all" || bondFilter === "pending";
  const showOptimisticBond = optimisticBond !== undefined && isAllOrPending;

  const filteredBonds = bondFilter === "all" ? bonds : getFilteredBonds(bonds, bondFilter);

  return (
    <>
      {
        // @ts-ignore (TS doesn't realise optimisticBond can't be undefined here)
        showOptimisticBond && <OptimisticBond bond={optimisticBond} style={{ mt: "16px" }} />
      }

      {filteredBonds.map((bond: BondType, idx: number) => {
        const isFirst = idx === 0 && !showOptimisticBond;
        const style = { mt: isFirst ? "16px" : "32px" };
        return <Bond bond={bond} key={idx} style={style} />;
      })}

      {!showOptimisticBond && filteredBonds.length === 0 && (
        <Box mt={2}>
          <ActionDescription>
            You don't have any {bondFilter !== "all" ? bondFilter : null} bonds
          </ActionDescription>
        </Box>
      )}
    </>
  );
};
