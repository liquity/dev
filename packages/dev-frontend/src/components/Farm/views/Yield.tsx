import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../../InfoIcon";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Badge } from "../../Badge";

const selector = ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
}: LiquityStoreState) => ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
});

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    };
    token: {
      derivedETH: string;
    };
    pair: {
      reserveUSD: string;
      totalSupply: string;
    };
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (lqtyTokenAddress: string, uniTokenAddress: string) => `{
  token(id: "${lqtyTokenAddress}") {
    derivedETH
  },
  bundle(id: 1) {
    ethPrice
  },
  pair(id: "${uniTokenAddress}") {
    totalSupply
    reserveUSD
  }
}`;

async function fetchPrices(lqtyTokenAddress: string, uniTokenAddress: string) {
  try {
    const response = await window.fetch(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          query: uniswapQuery(lqtyTokenAddress, uniTokenAddress),
          variables: null
        })
      }
    );

    const { data, errors }: UniswapResponse = await response.json();
    const hasRequiredData = data?.token !== null && data?.pair !== null && data?.bundle !== null;

    if (!hasRequiredData) {
      return Promise.reject("Uniswap doesn't have the required data to calculate yield");
    }

    if (errors) {
      return Promise.reject(errors);
    }

    if (response.ok && data !== undefined && hasRequiredData) {
      const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
      const lqtyPriceUSD = Decimal.from(data.token.derivedETH).mul(ethPriceUSD);
      const uniLpPriceUSD = Decimal.from(data.pair.reserveUSD).div(
        Decimal.from(data.pair.totalSupply)
      );

      return { lqtyPriceUSD, uniLpPriceUSD };
    }

    return Promise.reject("Failed to get prices from Uniswap");
  } catch (error) {
    return Promise.reject(error);
  }
}

export const Yield: React.FC = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();
  const { chainId } = useWeb3React<Web3Provider>();
  const isMainnet = chainId === 1;

  const { remainingLiquidityMiningLQTYReward, totalStakedUniTokens } = useLiquitySelector(selector);
  const [lqtyPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined);
  const [uniLpPrice, setUniLpPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingLiquidityMiningLQTYReward.isZero || totalStakedUniTokens.isZero;
  let lqtyTokenAddress = addresses["lqtyToken"];
  let uniTokenAddress = addresses["uniToken"];

  // TODO: remove after Team has reviewed on /next
  if (!isMainnet) {
    lqtyTokenAddress = "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2";
    uniTokenAddress = "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11";
  }

  useEffect(() => {
    (async () => {
      try {
        const { lqtyPriceUSD, uniLpPriceUSD } = await fetchPrices(lqtyTokenAddress, uniTokenAddress);
        setLqtyPrice(lqtyPriceUSD);
        setUniLpPrice(uniLpPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [lqtyTokenAddress, uniTokenAddress]);

  // TODO: switch to this condition after team has reviewed on /next
  // if (!isMainnet || hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;
  if (hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;

  const remainingLqtyInUSD = remainingLiquidityMiningLQTYReward.mul(lqtyPrice);
  const totalStakedUniLpInUSD = totalStakedUniTokens.mul(uniLpPrice);
  const yieldPercentage = remainingLqtyInUSD.div(totalStakedUniLpInUSD).mul(100);

  return (
    <Badge>
      <Text>Yield {yieldPercentage.prettify()}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip">
            <Paragraph>
              Yield is an <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the return based on
              the USD value of the remaining rewards and the currently staked UNI LP.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              (LQTY / UNI_LP) * 100 = <Text sx={{ fontWeight: "bold" }}> Yield</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} / ${totalStakedUniLpInUSD.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {yieldPercentage.prettify()}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
