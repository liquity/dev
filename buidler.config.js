usePlugin("@nomiclabs/buidler-truffle5");

const accounts = require("./accountsList.js");

const accountsList = accounts.accountsList

module.exports = {
    paths: {
        contracts: "./contracts",
        artifacts: "./artifacts"
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 1000
        }
    },
    networks: {
        buidlerevm: {
            accounts: accountsList,
            // expanded gas limits for testing
            gas: 9000000000,  // tx gas limit
            blockGasLimit: 9000000000 
        }
    },
    mocha: { timeout: 12000000 },
    rpc: {
        host: "localhost",
        port: 8545
    }
};
