#!/bin/bash

set -e

MAINNET_ADDRESS=0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2
MAINNNET_BLOCK_NUMBER=12178551
SUBGRAPH_FILE=subgraph.yaml

cp ${SUBGRAPH_FILE}.template ${SUBGRAPH_FILE}

if [[ -n ${ENVIRONMENT} ]]; then
    echo "dev: ${ENVIRONMENT}";
    TROVE_MANAGER_ADDRESS=$(cat ../lib-ethers/deployments/${ENVIRONMENT}.json | grep troveManager | cut -d'"' -f4)
fi;

if [[ -n ${TROVE_MANAGER_ADDRESS} ]]; then
    echo else: ${ENVIRONMENT}, ${TROVE_MANAGER_ADDRESS}
    sed -i -e "s/${MAINNET_ADDRESS}/${TROVE_MANAGER_ADDRESS}/g" ${SUBGRAPH_FILE}
fi

if [[ -n ${BLOCK_NUMBER} ]]; then
    echo else: ${ENVIRONMENT}, ${BLOCK_NUMBER}
    sed -i -e "s/${MAINNNET_BLOCK_NUMBER}/${BLOCK_NUMBER}/g" ${SUBGRAPH_FILE}
fi

rm -f subgraph.yaml-e

npx graph codegen

