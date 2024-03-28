import { Text } from "theme-ui";

type PoolBalanceProps = React.PropsWithChildren<{
  symbol: string;
}>;

export const PoolBalance: React.FC<PoolBalanceProps> = ({ symbol, children }) => (
  <>
    <Text sx={{ fontWeight: "medium" }}>{children}</Text>
    &nbsp;
    <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{symbol}</Text>
  </>
);
