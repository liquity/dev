# Liquity: Decentralized Borrowing Protocol

[![Frontend status](https://img.shields.io/uptimerobot/status/m784948796-056b56fd51c67d682c11bb24?label=Frontend&logo=nginx&logoColor=white)](http://94.130.72.96:3000/) ![uptime](https://img.shields.io/uptimerobot/ratio/7/m784948796-056b56fd51c67d682c11bb24) [![Discord](https://img.shields.io/discord/700620821198143498?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/2up5U32) [![Docker Pulls](https://img.shields.io/docker/pulls/liquity/dev-frontend?label=dev-frontend%20pulls&logo=docker&logoColor=white)](https://hub.docker.com/r/liquity/dev-frontend)

Liquity is a decentralized protocol that allows Ether holders to obtain maximum liquidity against
their collateral without paying interest. After locking up ETH as collateral in a smart contract and
creating an individual position called a "trove", the user can get instant liquidity by minting LQTY,
a USD-pegged stablecoin. Each trove is required to be collateralized at a minimum of 110%. Any
owner of LQTY can redeem their stablecoins for the underlying collateral at any time. The redemption
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

| Package               | Description                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| @liquity/decimal      | Decimal math using [ethers.js](https://github.com/ethers-io/ethers.js/)'s BigNumber                    |
| @liquity/dev-frontend | A bare-bones but functional React app used for interfacing with the smart contracts during development |
| @liquity/providers    | Customized ethers.js Providers used by dev-frontend                                                    |

## Running the dev-frontend

The dev-frontend has some dependencies that are not yet published in this repo, therefore it cannot be built from these sources yet. In the meantime, [images are available](https://hub.docker.com/r/liquity/dev-frontend) on Docker Hub.

### Prerequisites

You will need to have [Docker](https://docs.docker.com/get-docker/) installed.

### Run using `docker`

```
docker run --name liquity -d --rm -p 3000:80 liquity/dev-frontend
```

This will start serving the Liquity Developer Interface using HTTP on port 3000. If everything went well, you should be able to open http://localhost:3000/ in your browser. To use a different port, just replace 3000 with your desired port number.

To stop the service:

```
docker kill liquity
```

### Run using `docker-compose`

After cloning the repo, change to the `packages/dev-frontend` subdirectory. Inside there, run:

```
docker-compose pull
docker-compose up -d
```

This will start the service on port 80. This can be overridden by using the `LIQUITY_FRONTEND_HTTP_PORT` environment variable.

To stop the service, execute in the same directory:

```
docker-compose down
```

### Using your own HTTP server

Maybe you want to use a different server than nginx, or you need to use a different configuration, etc. Luckily, it is very easy to host the dev-frontend yourself — you just need to statically serve some files. To extract them from the Docker image, execute these commands:

```
docker create --name liquity liquity/dev-frontend
docker cp liquity:/usr/share/nginx/html /path/to/extract/files/to
docker rm liquity
```

Replace `/path/to/extract/files/to` with the location where you want to extract the files to.
