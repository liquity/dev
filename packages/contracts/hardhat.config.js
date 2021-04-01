require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("solidity-coverage");
require("hardhat-gas-reporter");
const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList

const fs = require('fs')
const getSecret = (secretKey) => {
    const SECRETS_FILE = "./secrets.js"
    let secret = ""
    if (fs.existsSync(SECRETS_FILE)) {
        const { secrets } = require(SECRETS_FILE);
        secret = secrets[secretKey]
    }

    return secret
}
const alchemyUrl = () => {
    return `https://eth-mainnet.alchemyapi.io/v2/${getSecret('alchemyAPIKey')}`
}

const alchemyUrlRinkeby = () => {
    return `https://eth-rinkeby.alchemyapi.io/v2/${getSecret('alchemyAPIKeyRinkeby')}`
}

module.exports = {
    paths: {
        // contracts: "./contracts",
        // artifacts: "./artifacts"
    },
    solidity: {
        compilers: [
            {
                version: "0.4.23",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
            {
                version: "0.5.17",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
            {
                version: "0.6.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
        ]
    },
    networks: {
        hardhat: {
            accounts: accountsList,
            gas: 10000000,  // tx gas limit
            blockGasLimit: 12500000, 
            gasPrice: 20000000000,
        },
        mainnet: {
            url: alchemyUrl(),
            gasPrice: 220000000000,
            accounts: [getSecret('DEPLOYER_PRIVATEKEY')]
        },
        rinkeby: {
            url: alchemyUrlRinkeby(),
            gas: 10000000,  // tx gas limit
            accounts: [getSecret('RINKEBY_DEPLOYER_PRIVATEKEY')]
        },
    },
    mocha: { timeout: 12000000 },
    rpc: {
        host: "localhost",
        port: 8545
    },
    gasReporter: {
        enabled: (process.env.REPORT_GAS) ? true : false
    }
};
