import { Decimal } from "@liquity/lib-base";
import { Text, Box, Flex } from "theme-ui";
import { StaticRow, StaticAmounts } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { PoolBalance } from "./PoolBalance";

export const PoolDetails: React.FC = () => {
  const { lpTokenSupply, bLusdAmmBLusdBalance, bLusdAmmLusdBalance, protocolInfo } = useBondView();
  const poolBalanceRatio =
    bLusdAmmBLusdBalance && bLusdAmmLusdBalance
      ? bLusdAmmLusdBalance.div(bLusdAmmBLusdBalance)
      : Decimal.ONE;

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
            <PoolBalance symbol="LUSD-3CRV">
              {(bLusdAmmLusdBalance ?? Decimal.ZERO).prettify(2)}
            </PoolBalance>
          </StaticAmounts>
        </StaticRow>

        <StaticRow label="Pool balance ratio">
          <StaticAmounts
            sx={{ alignItems: "center", justifyContent: "flex-start" }}
            inputId="deposit-pool-ratio"
          >
            <PoolBalance symbol="bLUSD">1</PoolBalance>
            <Text sx={{ fontWeight: "thin", mx: "6px" }}>:</Text>
            <PoolBalance symbol="LUSD-3CRV">{poolBalanceRatio.prettify(2)}</PoolBalance>
          </StaticAmounts>
        </StaticRow>

        <Flex>
          <StaticRow
            label="LP token supply"
            inputId="deposit-mint-lp-tokens"
            amount={(lpTokenSupply ?? Decimal.ZERO).prettify(2)}
          />

          <StaticRow label="bLUSD price">
            <StaticAmounts sx={{ alignItems: "center", justifyContent: "flex-start" }}>
              <PoolBalance symbol="LUSD">
                {(protocolInfo?.marketPrice ?? Decimal.INFINITY).prettify(2)}
              </PoolBalance>{" "}
            </StaticAmounts>
          </StaticRow>

          <StaticRow label="bLUSD LP APR">
            <StaticAmounts sx={{ alignItems: "center", justifyContent: "flex-start" }}>
              <PoolBalance symbol="%">
                {(protocolInfo?.bLusdLpApr ?? Decimal.INFINITY).prettify(2)}
              </PoolBalance>{" "}
            </StaticAmounts>
          </StaticRow>
        </Flex>
      </Box>
    </details>
  );
};
