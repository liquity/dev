usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-ethers");
// usePlugin("solidity-coverage");

const accounts = require("./buidlerAccountsList2k.js");

const accountsList = accounts.accountsList

module.exports = {
    paths: {
        // contracts: "./contracts",
        // artifacts: "./artifacts"
    },
    solc: {
        version: "0.5.16",
        optimizer: {
            enabled: true,
            runs: 100
        }
    },
    networks: {
        buidlerevm: {
            accounts: accountsList,
            // expanded gas limits for testing
            gas: 9000000000,  // tx gas limit
            blockGasLimit: 9000000000, 
            gasPrice: 20000000000
        }
    },
    mocha: { timeout: 12000000 },
    rpc: {
        host: "localhost",
        port: 8545
    }
};
