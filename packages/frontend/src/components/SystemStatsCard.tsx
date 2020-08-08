import React from "react";
import { Card, Heading, SxProps } from "theme-ui";

export const SystemStatsCard: React.FC<SxProps> = ({ sx }) => (
  <Card {...{ sx }}>
    <Heading>Liquity System</Heading>

    <table>
      <tbody>
        {[
          ["Total collateral ratio:", "311%"],
          ["Total LQTY supply:", "7.48M"],
          ["LQTY in Stability Pool:", "1.35M"],
          ["% of LQTY in Stability Pool:", "18%"],
          ["Number of Troves:", "3421"]
        ].map(([c1, c2], i) => (
          <tr key={i}>
            <td>{c1}</td>
            <td style={{ textAlign: "right" }}>{c2}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);
