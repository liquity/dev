import { Decimal } from "@liquity/lib-base";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useBondView } from "./Bonds/context/BondViewContext";

const labels = ["Pending", "Reserve", "Permanent"];
const colors = ["#7a77c2", "#6d6aad", "#5f5c97"];
const RADIAN = Math.PI / 180;

// @ts-ignore
const BucketLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      fontSize={15}
      fontWeight={300}
      x={x * 1.078}
      y={y * 0.985}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {labels[index]}
    </text>
  );
};

export const TreasuryChart = () => {
  const { protocolInfo } = useBondView();

  if (protocolInfo === undefined) return null;

  const treasuryChartData = [];

  if (protocolInfo.treasury.pending !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Pending",
      value: parseFloat(protocolInfo.treasury.pending.toString())
    });
  }

  if (protocolInfo.treasury.reserve !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Reserve",
      value: parseFloat(protocolInfo.treasury.reserve.toString())
    });
  }

  if (protocolInfo.treasury.permanent !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Permanent",
      value: parseFloat(protocolInfo.treasury.permanent.toString())
    });
  }

  return (
    <ResponsiveContainer width="100%" height={348}>
      <PieChart width={80} height={250}>
        <Tooltip isAnimationActive={false} />
        <Pie
          data={treasuryChartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={BucketLabel}
          isAnimationActive={false}
          strokeOpacity="0.55"
        >
          {treasuryChartData.map((_, index) => (
            <Cell key={`label-${index}`} fill={colors[index]} />
          ))}
        </Pie>
        <Pie
          data={treasuryChartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={110}
          outerRadius={136}
          isAnimationActive={false}
          strokeOpacity="0.55"
          label={({ x, y, percent, index }) => (
            <g>
              <circle textAnchor="middle" cx={x * 0.95} cy={y * 0.95} r={23} fill={colors[index]} />
              <text
                x={x * 0.95}
                y={y * 0.95}
                fontSize={15.5}
                fill="white"
                fontWeight={300}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {`${(percent * 100).toFixed(0)}%`}
              </text>
            </g>
          )}
          labelLine={false}
        >
          {treasuryChartData.map((_, index) => (
            <Cell key={`share-${index}`} fill={colors[index]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
