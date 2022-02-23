const { mainnetDeploy } = require('./mainnetDeployment.js')
const configParams = require("./deploymentParams.localFork.js")

const ETH_WHALE = "0x53d284357ec70ce289d6d64134dfac8e511c8a3d"
//const TEST_DEPLOYER_PRIVATEKEY = '0xbbfbee4961061d506ffbb11dfea64eba16355cbf1d9c29613126ba7fec0aed5d'

async function main() {
  await mainnetDeploy(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
