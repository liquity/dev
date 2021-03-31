import { Decimal } from "@liquity/lib-base";

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    };
    token: {
      derivedETH: string;
    };
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (lqtyTokenAddress: string) => `{
  token(id: "${lqtyTokenAddress}") {
    derivedETH
  },
  bundle(id: 1) {
    ethPrice
  },
}`;

export async function fetchLqtyPrice(lqtyTokenAddress: string) {
  try {
    const response = await window.fetch(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          query: uniswapQuery(lqtyTokenAddress),
          variables: null
        })
      }
    );

    const { data, errors }: UniswapResponse = await response.json();
    const hasRequiredData = data?.token !== null && data?.bundle !== null;

    if (!hasRequiredData) {
      return Promise.reject("Uniswap doesn't have the required data to calculate yield");
    }

    if (errors) {
      return Promise.reject(errors);
    }

    if (response.ok && hasRequiredData && data !== undefined) {
      const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
      const lqtyPriceUSD = Decimal.from(data.token.derivedETH).mul(ethPriceUSD);

      return { lqtyPriceUSD };
    }

    return Promise.reject("Failed to get prices from Uniswap");
  } catch (error) {
    return Promise.reject(error);
  }
}
