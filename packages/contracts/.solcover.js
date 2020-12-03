const { accountsList } = require("./buidlerAccountsList2k.js");
// syntax for solcover network (ganache based) is different:
// https://hardhat.org/plugins/solidity-coverage.html#configuration
// Link in providerOptions:
// https://github.com/trufflesuite/ganache-core#options
const accounts = accountsList.map(a => ({ secretKey: a.privateKey, balance: '0xc097ce7bc90715b34b9f1000000000' }))

module.exports = {
  providerOptions: {
    accounts
  },

  // Improve performance by skipping statements and functions. Tool still checks lines of code and branches:
  // https://github.com/sc-forks/solidity-coverage/blob/master/docs/advanced.md
  //measureStatementCoverage: false,
  //measureFunctionCoverage: false,

  skipFiles: [
    "TestContracts/",
    "MultiTroveGetter.sol",
    "Migrations.sol",
    "Interfaces/",
    "Dependencies/Context.sol",
    "Dependencies/IERC20.sol",
    "Dependencies/IERC2612.sol",
    "Dependencies/Math.sol",
    "Dependencies/Ownable.sol",
    "Dependencies/SafeMath.sol",
    "Dependencies/SafeMath128.sol",
    "Dependencies/console.sol",
  ]
};
