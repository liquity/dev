import { Decimal } from "@liquity/lib-base";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useBondView } from "./Bonds/context/BondViewContext";

const labels = ["Pending", "Reserve", "Permanent"];
const colors = ["#7a77c2", "#6d6aad", "#5f5c97"];
const RADIAN = Math.PI / 180;

export const TreasuryChart = () => {
  const { protocolInfo } = useBondView();

  if (protocolInfo === undefined) return null;

  const treasuryChartData = [];

  const buckets = [
    parseFloat(protocolInfo.treasury.pending.toString()),
    parseFloat(protocolInfo.treasury.reserve.toString()),
    parseFloat(protocolInfo.treasury.permanent.toString())
  ];

  if (protocolInfo.treasury.pending !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Pending",
      value: buckets[0]
    });
  }

  if (protocolInfo.treasury.reserve !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Reserve",
      value: buckets[1]
    });
  }

  if (protocolInfo.treasury.permanent !== Decimal.ZERO) {
    treasuryChartData.push({
      name: "Permanent",
      value: buckets[2]
    });
  }

  return (
    <ResponsiveContainer width="100%" height={348}>
      <PieChart>
        <Tooltip isAnimationActive={false} />
        <Pie
          data={treasuryChartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
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
                {buckets[index] > 0 ? labels[index] : ""}
              </text>
            );
          }}
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
          outerRadius={132}
          isAnimationActive={false}
          strokeOpacity="0.55"
          label={({ x, y, percent, index }) => {
            if (!(buckets[index] > 0)) return null;
            return (
              <g>
                <circle
                  textAnchor="middle"
                  cx={x < 131 ? x * 1.3 : x * 0.96}
                  cy={y < 131 ? y * 1.3 : y * 0.99}
                  r={19}
                  fill={colors[index]}
                />
                <text
                  x={x < 131 ? x * 1.3 : x * 0.96}
                  y={y < 131 ? y * 1.3 : y * 0.99}
                  fontSize={15.5}
                  fill="white"
                  fontWeight={300}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {`${(percent * 100).toFixed(0)}%`}
                </text>
              </g>
            );
          }}
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
