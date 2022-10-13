import { Decimal } from "@liquity/lib-base";
import { Text, Box } from "theme-ui";
import { StaticRow, StaticAmounts } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";

const PoolBalance: React.FC<{ symbol: string }> = ({ symbol, children }) => (
  <>
    <Text sx={{ fontWeight: "medium" }}>{children}</Text>
    &nbsp;
    <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{symbol}</Text>
  </>
);

export const PoolDetails: React.FC = () => {
  const { lpTokenSupply, bLusdAmmBLusdBalance, bLusdAmmLusdBalance } = useBondView();

  return (
    <details>
      <Box as="summary" sx={{ cursor: "pointer", mb: 3, ml: 2 }}>
        Pool details
      </Box>

      <Box sx={{ mt: 3 }}>
        <StaticRow label="Pool balance">
          <StaticAmounts
            sx={{ alignItems: "center", justifyContent: "flex-start" }}
            inputId="deposit-pool-balance"
          >
            <PoolBalance symbol="bLUSD">
              {(bLusdAmmBLusdBalance ?? Decimal.ZERO).prettify(2)}
            </PoolBalance>

            <Text sx={{ fontWeight: "light", mx: "12px" }}>+</Text>

            <PoolBalance symbol="LUSD">
              {(bLusdAmmLusdBalance ?? Decimal.ZERO).prettify(2)}
            </PoolBalance>
          </StaticAmounts>
        </StaticRow>

        <StaticRow
          label="LP token supply"
          inputId="deposit-mint-lp-tokens"
          amount={(lpTokenSupply ?? Decimal.ZERO).prettify(2)}
        />
      </Box>
    </details>
  );
};
