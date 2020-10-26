const { accountsList: accounts } = require("./buidlerAccountsList2k.js");

module.exports = {
  providerOptions: {
    accounts
  },

  skipFiles: [
    "TestContracts/",
    "MultiCDPGetter.sol",
    "Migrations.sol",
    "Interfaces/",
    "Dependencies/Context.sol",
    "Dependencies/IERC20.sol",
    "Dependencies/Math.sol",
    "Dependencies/Ownable.sol",
    "Dependencies/SafeMath.sol",
    "Dependencies/SafeMath128.sol",
    "Dependencies/console.sol",
  ]
};
