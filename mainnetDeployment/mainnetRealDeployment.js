const { mainnetDeploy } = require('./mainnetDeployment.js')
const configParams = require("./deploymentParams.mainnet.js")
const readline = require('readline-sync');

async function main() {
  var userinput = 0;
  userinput = readline.question(addColor(33, `\nYou are about to deploy on the mainnet, is it fine? [y/N]\n`));

  if (userinput.toLowerCase() !== 'y') {
    console.log(addColor(31, `User cancelled the deployment!\n`));
    return;
  }

  console.log(addColor(32, `User approved the deployment... deploying....\n`));

  await mainnetDeploy(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });


function addColor(colorCode, msg) {
  return '\u001b[' + colorCode + 'm' + msg + '\u001b[0m';
}
