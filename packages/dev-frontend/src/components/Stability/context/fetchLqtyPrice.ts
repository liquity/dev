import { Decimal } from "@liquity/lib-base";

type UniswapResponse = {
  data?: {
    bundle: {
      ethPrice: string;
    } | null;
    token: {
      derivedETH: string;
    } | null;
  };
  errors?: Array<{ message: string }>;
};

const uniswapQuery = (lqtyTokenAddress: string) => `{
  token(id: "${lqtyTokenAddress.toLowerCase()}") {
    derivedETH
  },
  bundle(id: 1) {
    ethPrice
  },
}`;

export async function fetchLqtyPrice(lqtyTokenAddress: string) {
  const response = await window.fetch("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: uniswapQuery(lqtyTokenAddress),
      variables: null
    })
  });
  if (!response.ok) {
    return Promise.reject("Network error connecting to Uniswap subgraph");
  }

  const { data, errors }: UniswapResponse = await response.json();

  if (errors) {
    return Promise.reject(errors);
  }

  if (typeof data?.token?.derivedETH === "string" && typeof data?.bundle?.ethPrice === "string") {
    const ethPriceUSD = Decimal.from(data.bundle.ethPrice);
    const lqtyPriceUSD = Decimal.from(data.token.derivedETH).mul(ethPriceUSD);

    return { lqtyPriceUSD };
  }

  return Promise.reject("Uniswap doesn't have the required data to calculate yield");
}
