const { secrets } = require("../secrets.js");
const { mainnetDeploy } = require('./mainnetDeployment.js')
const { liquityAddrs } = require("./mainnetAddresses.js")

async function main() {
    const mainnetProvider = new ethers.providers.AlchemyProvider(null, secrets.alchemyAPIKey)
    const deployerWallet = new ethers.Wallet(secrets.DEPLOYER_PRIVATEKEY, mainnetProvider)

    await mainnetDeploy(mainnetProvider, deployerWallet, liquityAddrs)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
