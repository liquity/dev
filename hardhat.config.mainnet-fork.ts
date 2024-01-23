import { HardhatUserConfig } from "hardhat/config";

const alchemyApiKey = process.env.ALCHEMY_API_KEY;

const config: HardhatUserConfig = {
  solidity: "0.7.3",
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
        blockNumber: 16233419
      },
      accounts: [
        {
          privateKey: "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7",
          balance: "100000000000000000000000"
        }
      ],
      initialBaseFeePerGas: 0
    }
  }
};

export default config;
