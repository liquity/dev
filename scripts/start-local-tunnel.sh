#!/bin/bash
set -e

# Change directory to this file so we can run this script from anywhere
cd "$(dirname "$0")"

function kill_frontend_instance { lsof -ti tcp:32318 | xargs kill; }

# If this script fails or is killed, kill the frontend instance as it will still be running
trap kill_frontend_instance EXIT
trap kill_frontend_instance SIGINT
trap kill_frontend_instance INT

# If this script somehow started with a zombie frontend instance, kill it
kill_frontend_instance

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'

# Check local rpc node is running
cast client --rpc-url "http://localhost:8545" > /dev/null || (echo -e "\n${RED}RPC node localhost:8545 isn't up and running.\nRun yarn start-fork:rpc-node\n" && exit 1)

# Check ngrok config file exists
if ! [ -f "../ngrok.config.yml" ]; then
    echo "\n${RED}You need to create an ngrok.config.yml inside the Liquity dev repository root."
    echo "\nSee ngrok.config.template.yml for an example."
    exit 1
fi

if [ -z $NGROK_AUTH_TOKEN ]
then 
  echo -e "\n${RED}You need to set NGROK_AUTH_TOKEN environment variable"
  exit 1
fi


# Start tunnel to frontend and RPC node
lsof -i -P -n | grep LISTEN | grep 41356 > /dev/null && killall ngrok
ngrok start --authtoken $NGROK_AUTH_TOKEN --config ../ngrok.config.yml web rpc &
sleep 1

# Get RPC URL from ngrok
NGROK_RPC_URL=$(curl --silent http://127.0.0.1:41356/api/tunnels | { \
  read -d '' config; \
  node --print "try { \
    const tunnels = JSON.parse('$config').tunnels; \
    tunnels[0].name === 'rpc' ? tunnels[0].public_url : tunnels[1].public_url \
  } catch {}"; \
})

# Check we have an RPC URL
if [ $NGROK_RPC_URL == "null" ] || [ $NGROK_RPC_URL == "undefined" ]; then  
  echo -e "${RED}Couldn't find an instance of the RPC node running in NGROK.\n"
  echo -e "If you haven't created an ngrok.config.yml file please see ngrok.config.template.yml for an example.\n"
  exit 1
fi


# Start frontend with configured RPC URL
PORT=32318 BROWSER=none REACT_APP_RPC_URL="$NGROK_RPC_URL" yarn workspace @liquity/dev-frontend start-demo >/dev/null &
