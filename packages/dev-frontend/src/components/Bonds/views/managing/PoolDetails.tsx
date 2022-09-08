/** @jsxImportSource theme-ui */
import { Decimal } from "@liquity/lib-base";
import { Flex, Text, Box } from "theme-ui";
import { StaticRow } from "../../../Trove/Editor";
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
      <summary sx={{ cursor: "pointer", mb: 3 }}>Pool details</summary>

      <Box sx={{ mt: 3 }}>
        <StaticRow label="Pool balance" inputId="deposit-pool-balance">
          <Flex sx={{ alignItems: "center" }}>
            <PoolBalance symbol="bLUSD">
              {(bLusdAmmBLusdBalance ?? Decimal.ZERO).prettify(2)}
            </PoolBalance>

            <Text sx={{ fontWeight: "light", mx: "12px" }}>+</Text>

            <PoolBalance symbol="LUSD">
              {(bLusdAmmLusdBalance ?? Decimal.ZERO).prettify(2)}
            </PoolBalance>
          </Flex>
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
