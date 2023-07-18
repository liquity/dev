# @stabilio/lib-ethers

[Ethers](https://www.npmjs.com/package/ethers)-based library for reading Stabilio protocol state and sending transactions.

## Quickstart

Install in your project:

```
npm install --save @stabilio/lib-base @stabilio/lib-ethers ethers@^5.0.0
```

Connecting to an Ethereum node and sending a transaction:

```javascript
const { Wallet, providers } = require("ethers");
const { EthersStabilio } = require("@stabilio/lib-ethers");

async function example() {
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY).connect(provider);
  const stabilio = await EthersStabilio.connect(wallet);

  const { newTrove } = await stabilio.openTrove({
    depositCollateral: 5, // ETH
    borrowXBRL: 2000
  });

  console.log(`Successfully opened a Stabilio Trove (${newTrove})!`);
}
```

## More examples

See [packages/examples](https://github.com/stabilio/stabilio/tree/master/packages/examples) in the repo.

Stabilio's [Dev UI](https://github.com/stabilio/stabilio/tree/master/packages/dev-frontend) itself contains many examples of `@stabilio/lib-ethers` use.

## API Reference

For now, it can be found in the public Stabilio [repo](https://github.com/stabilio/stabilio/blob/master/docs/sdk/lib-ethers.md).

