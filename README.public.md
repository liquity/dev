# DEPRECATION NOTICE
This repositiory was the public preview of the internal Liquity codebase. Since Liquity launched, our private repo has been public, and is now the source of truth. This repo now serves as an archive. It doesn't have Liquity's latest code.

Please use the [liquity/dev](https://github.com/liquity/dev) codebase instead.

------

The old README was as follows:

# Liquity: Decentralized Borrowing Protocol

[![Frontend status](https://img.shields.io/uptimerobot/status/m784948796-056b56fd51c67d682c11bb24?label=Testnet&logo=nginx&logoColor=white)](https://devui.liquity.org) ![uptime](https://img.shields.io/uptimerobot/ratio/7/m784948796-056b56fd51c67d682c11bb24) [![Discord](https://img.shields.io/discord/700620821198143498?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/2up5U32) [![Docker Pulls](https://img.shields.io/docker/pulls/liquity/dev-frontend?label=dev-frontend%20pulls&logo=docker&logoColor=white)](https://hub.docker.com/r/liquity/dev-frontend)

Liquity is a decentralized protocol that allows Ether holders to obtain maximum liquidity against
their collateral without paying interest. After locking up ETH as collateral in a smart contract and
creating an individual position called a "trove", the user can get instant liquidity by minting LUSD,
a USD-pegged stablecoin. Each trove is required to be collateralized at a minimum of 110%. Any
owner of LUSD can redeem their stablecoins for the underlying collateral at any time. The redemption
mechanism along with algorithmically adjusted fees guarantee a minimum stablecoin value of USD 1.

An unprecedented liquidation mechanism based on incentivized stability deposits and a redistribution
cycle from riskier to safer troves provides stability at a much lower collateral ratio than current
systems. Stability is maintained via economically-driven user interactions and arbitrage, rather
than by active governance or monetary interventions.

The protocol has built-in incentives that encourage both early adoption and the operation of
multiple front ends, enhancing decentralization.

## More information

Visit [liquity.org](https://www.liquity.org) to find out more and join the discussion.

## About this repo

This repository hosts an early preview of the Liquity codebase until we get ready to open it up completely. Development continues to take place in a private repository, from which this repository is derived using [git filter-repo](https://github.com/newren/git-filter-repo).

### Packages

These are the Liquity components that have been made visible in this repo. They can be found under the `packages` directory.

| Package               | Description                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| @liquity/dev-frontend | [Dev UI](https://devui.liquity.org): a bare-bones but functional React app used for interfacing with the smart contracts during development |
| @liquity/lib-base     | Common interfaces and classes shared by the other `lib-` packages                                                                           |
| @liquity/lib-ethers   | [Ethers](https://github.com/ethers-io/ethers.js/)-based middleware that can read Liquity state and send transactions                        |
| @liquity/lib-react    | Components and hooks that React-based apps can use to view Liquity contract state                                                           |
| @liquity/lib-subgraph | [Apollo Client](https://github.com/apollographql/apollo-client)-based middleware backed by the Liquity subgraph that can read Liquity state |
| @liquity/providers    | Customized ethers.js Providers used by dev-frontend                                                                                         |
| @liquity/subgraph     | [Subgraph](https://thegraph.com) for querying Liquity state as well as historical data like transaction history                             |

## Running Dev UI with Docker

The quickest way to get Dev UI up and running is to use the [prebuilt image](https://hub.docker.com/r/liquity/dev-frontend) available on Docker Hub.

### Prerequisites

You will need to have [Docker](https://docs.docker.com/get-docker/) installed.

### Running with `docker`

```
docker pull liquity/dev-frontend
docker run --name liquity -d --rm -p 3000:80 liquity/dev-frontend
```

This will start serving Dev UI using HTTP on port 3000. If everything went well, you should be able to open http://localhost:3000/ in your browser. To use a different port, just replace 3000 with your desired port number.

To stop the service:

```
docker kill liquity
```

### Configuring a public Dev UI

If you're planning to publicly host Dev UI, you might need to pass the Docker container some extra configuration in the form of environment variables.

#### FRONTEND_TAG

If you want to receive a share of the LQTY rewards earned by users of your Dev UI, set this variable to the Ethereum address you want the LQTY to be sent to.

#### INFURA_API_KEY

This is an optional parameter. If you'd like your Dev UI to use Infura's [WebSocket endpoint](https://infura.io/docs/ethereum#section/Websockets) for receiving blockchain events, set this variable to an Infura Project ID.

### Setting a kickback rate

The kickback rate is the portion of LQTY you pass on to users of your Dev UI. For example with a kickback rate of 80%, you receive 20% while users get the other 80. Before you can start to receive a share of LQTY rewards, you'll need to set this parameter by making a transaction on-chain.

It is highly recommended that you do this while running Dev UI locally, before you start hosting it publicly:

```
docker run --name liquity -d --rm -p 3000:80 \
  -e FRONTEND_TAG=0x2781fD154358b009abf6280db4Ec066FCC6cb435 \
  -e INFURA_API_KEY=158b6511a5c74d1ac028a8a2afe8f626 \
  liquity/dev-frontend
```

Remember to replace the environment variables in the above example. After executing this command, open http://localhost:3000/ in a browser with MetaMask installed, then switch MetaMask to the account whose address you specified as FRONTEND_TAG to begin setting the kickback rate.

### Next steps for hosting Dev UI

Now that you've set a kickback rate, you'll need to decide how you want to host your frontend. There are way too many options to list here, so these are going to be just a few examples.

#### Example 1: using static website hosting

Dev UI doesn't require any database or server-side computation, so the easiest way to host it is to use a service that lets you upload a folder of static files (HTML, CSS, JS, etc).

To obtain the files you need to upload, you need to extract them from a Dev UI Docker container. If you were following the guide for setting a kickback rate and haven't stopped the container yet, then you already have one! Otherwise, you can create it with a command like this (remember to use your own `FRONTEND_TAG` and `INFURA_API_KEY`):

```
docker run --name liquity -d --rm \
  -e FRONTEND_TAG=0x2781fD154358b009abf6280db4Ec066FCC6cb435 \
  -e INFURA_API_KEY=158b6511a5c74d1ac028a8a2afe8f626 \
  liquity/dev-frontend
```

While the container is running, use `docker cp` to extract Dev UI's files to a folder of your choosing. For example to extract them to a new folder named "devui" inside the current folder, run:

```
docker cp liquity:/usr/share/nginx/html ./devui
```

Upload the contents of this folder to your chosen hosting service (or serve them using your own infrastructure), and you're set!

#### Example 2: wrapping the Dev UI container in HTTPS

If you have command line access to a server with Docker installed, hosting Dev UI from a Docker container is a viable option.

The Dev UI Docker container simply serves files using plain HTTP, which is susceptible to man-in-the-middle attacks. Therefore it is highly recommended to wrap it in HTTPS using a reverse proxy. You can find an example docker-compose config [here](packages/dev-frontend/docker-compose-example/docker-compose.yml) that secures Dev UI using [SWAG (Secure Web Application Gateway)](https://github.com/linuxserver/docker-swag) and uses [watchtower](https://github.com/containrrr/watchtower) for automatically updating the Dev UI image to the latest version on Docker Hub.

Remember to customize both [docker-compose.yml](packages/dev-frontend/docker-compose-example/docker-compose.yml) and the [site config](packages/dev-frontend/docker-compose-example/config/nginx/site-confs/liquity.example.com).

## Building Dev UI from source

If you want to customize the functionality or look of Dev UI, you'll need to build it yourself from source.

### Prerequisites

Node v12 and Yarn v1.

### Install dependencies and build libraries

Inside the root directory of the repo:

```
yarn
```

### Start Dev UI in development mode

```
yarn start-dev-frontend
```

This will start Dev UI in development mode on http://localhost:3000. The app will automatically be reloaded if you change a source file inside `packages/dev-frontend`.

If you make changes to a different package, it is recommended to rebuild the entire project with `yarn prepare` in the root directory of the repo.

### Build optimized Dev UI for production

```
cd packages/dev-frontend
yarn build
```

You'll find the output in `packages/dev-frontend/build`.

### Configuring your custom Dev UI

Your custom built Dev UI can be configured by putting a file named `config.json` inside the same directory as `index.html` built in the previous step. The format of this file is:

```
{
  "frontendTag": "0x2781fD154358b009abf6280db4Ec066FCC6cb435",
  "infuraApiKey": "158b6511a5c74d1ac028a8a2afe8f626"
}
```
