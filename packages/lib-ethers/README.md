# @fluidity/lib-ethers

[Ethers](https://www.npmjs.com/package/ethers)-based library for reading Fluidity protocol state and sending transactions.

## Quickstart

Install in your project:

```
npm install --save @fluidity/lib-base @fluidity/lib-ethers ethers@^5.0.0
```

Connecting to an Ethereum node and sending a transaction:

```javascript
const { Wallet, providers } = require("ethers");
const { EthersFluidity } = require("@fluidity/lib-ethers");

async function example() {
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY).connect(provider);
  const fluidity = await EthersFluidity.connect(wallet);

  const { newTrove } = await fluidity.openTrove({
    depositCollateral: 5, // ETH
    borrowLUSD: 2000
  });

  console.log(`Successfully opened a Fluidity Trove (${newTrove})!`);
}
```

## More examples

See [packages/examples](https://github.com/goldmandao/fluidity/tree/master/packages/examples) in the repo.

Fluidity's [Dev UI](https://github.com/goldmandao/fluidity/tree/master/packages/dev-frontend) itself contains many examples of `@fluidity/lib-ethers` use.

## API Reference

For now, it can be found in the public Fluidity [repo](https://github.com/goldmandao/fluidity/blob/master/docs/sdk/lib-ethers.md).

