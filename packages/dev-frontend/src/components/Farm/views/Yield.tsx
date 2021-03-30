import React, { useEffect, useState } from "react";
import { Card, Flex, Text } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../../InfoIcon";
import { useLiquity } from "../../../hooks/LiquityContext";

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
    const hasLqtyTokenData = data?.token !== null;

    console.log({ data, errors, hasLqtyTokenData });

    if (!hasLqtyTokenData) {
      return Promise.reject("No LQTY token data on Uniswap yet");
    }
    if (errors) {
      return Promise.reject(errors);
    }

    if (response.ok && data !== undefined && hasLqtyTokenData) {
      const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
      const lqtyPriceUSD = Decimal.from(data.token.derivedETH).mul(ethPriceUSD);
      const uniLpPriceUSD = Decimal.from(data.pair.reserveUSD).div(
        Decimal.from(data.pair.totalSupply)
      );

      console.log(ethPriceUSD.prettify(), lqtyPriceUSD.prettify(), uniLpPriceUSD.prettify());
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
  const { remainingLiquidityMiningLQTYReward, totalStakedUniTokens } = useLiquitySelector(selector);
  const [lqtyPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined);
  const [uniLpPrice, setUniLpPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingLiquidityMiningLQTYReward.isZero || totalStakedUniTokens.isZero;
  const lqtyTokenAddress = addresses["lqtyToken"];
  const uniTokenAddress = addresses["uniToken"];

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
  }, []);

  if (hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;

  const remainingLqtyInUSD = remainingLiquidityMiningLQTYReward.mul(lqtyPrice);
  const totalStakedUniLpInUSD = totalStakedUniTokens.mul(uniLpPrice);
  const yieldPercentage = remainingLqtyInUSD.div(totalStakedUniLpInUSD).mul(100);
  console.log(remainingLqtyInUSD.prettify(), totalStakedUniLpInUSD.prettify());

  return (
    <Flex
      sx={{
        border: 0,
        borderRadius: 3,
        p: 1,
        px: 2,
        backgroundColor: "muted",
        color: "slate",
        fontSize: 1,
        fontWeight: "thin"
      }}
    >
      <Text>Yield {yieldPercentage.prettify()}%</Text>
      <InfoIcon tooltip={<Card variant="tooltip">Current</Card>}></InfoIcon>
    </Flex>
  );
};
