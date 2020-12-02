const { accountsList: accounts } = require("./buidlerAccountsList2k.js");

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
