import React from "react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";

const labels = ["Pending", "Reserve", "Permanent"];
const colors = ["#7a77c2", "#6d6aad", "#5f5c97"];
const RADIAN = Math.PI / 180;
const treasury = [
  {
    name: "Pending",
    value: 850000,
    share: 7
  },
  {
    name: "Reserve",
    value: 7100000,
    share: 62
  },
  {
    name: "Permanent",
    value: 3600000,
    share: 31
  }
];

// @ts-ignore
const BucketLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      fontSize={16}
      fontWeight={300}
      x={index === 0 ? x + 20 : x + 10}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {labels[index]}
    </text>
  );
};

// @ts-ignore
const ShareLabel = ({ x, y, index }) => {
  const radius = 20;
  const positions = [
    {
      // Pending
      text: {
        x: -34,
        y: 8
      },
      circle: {
        x: -24,
        y: 8
      }
    },
    {
      // Acquired
      text: {
        x: -3,
        y: 20
      },
      circle: {
        x: 8,
        y: 20
      }
    },
    {
      // Permanent
      text: {
        x: -22,
        y: -22
      },
      circle: {
        x: -6,
        y: -25
      }
    }
  ];

  return (
    <g>
      <circle
        textAnchor="outside"
        cx={x + positions[index].circle.x}
        cy={y + positions[index].circle.y}
        r={radius}
        fill={colors[index]}
      />
      <text
        x={x + positions[index].text.x}
        y={y + positions[index].text.y}
        fill="white"
        textAnchor="outside"
        dominantBaseline="middle"
      >
        {treasury[index].share}%
      </text>
    </g>
  );
};

export const TreasuryChart = () => {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart width={100} height={250}>
        <Tooltip isAnimationActive={false} />
        <Pie
          data={treasury}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={BucketLabel}
          isAnimationActive={false}
          strokeOpacity="0.55"
        >
          {treasury.map((_, index) => (
            <Cell key={`label-${index}`} fill={colors[index]} />
          ))}
        </Pie>
        <Pie
          data={treasury}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={110}
          outerRadius={136}
          isAnimationActive={false}
          strokeOpacity="0.55"
          label={ShareLabel}
          labelLine={false}
        >
          {treasury.map((_, index) => (
            <Cell key={`share-${index}`} fill={colors[index]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
