const { accountsList: accounts } = require("./accountsList.js");

module.exports = {
  providerOptions: {
    accounts
  },

  skipFiles: [
    "ABDKMath64x64.sol",
    "FunctionCaller.sol",
    "Migrations.sol",
    "MultiCDPGetter.sol",
    "NameRegistry.sol",

    "Interfaces"
  ]
};
