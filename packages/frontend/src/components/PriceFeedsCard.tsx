import React from "react";
import { Card, Heading, SxProps } from "theme-ui";

export const PriceFeedsCard: React.FC<SxProps> = ({ sx }) => (
  <Card {...{ sx }}>
    <Heading>Price Feeds</Heading>

    <table style={{ width: "100%" }}>
      <tbody>
        <tr>
          <td>ETH:</td>
          <td style={{ textAlign: "right" }}>$161.13</td>
        </tr>
        <tr>
          <td>LQTY:</td>
          <td style={{ textAlign: "right" }}>$1.01</td>
        </tr>
      </tbody>
    </table>
  </Card>
);
