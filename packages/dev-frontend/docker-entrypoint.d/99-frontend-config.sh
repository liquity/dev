#!/bin/sh

echo_config() {
  echo '{'
  [ -n "$TESTNET_ONLY" ] && echo '  "testnetOnly": '$TESTNET_ONLY','
  echo '  "frontendTag": "'$FRONTEND_TAG'",'
  echo '  "infuraApiKey": "'$INFURA_API_KEY'",'
  echo '  "alchemyApiKey": "'$ALCHEMY_API_KEY'",'
  echo '  "walletConnectProjectId": "'$WALLET_CONNECT_PROJECT_ID'"'
  echo '}'
}

echo_config > /usr/share/nginx/html/config.json

exit 0
