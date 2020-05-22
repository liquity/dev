import fs from "fs";
import path from "path";
import { sha1 } from "object-hash";

import { abi, LiquityDeployment } from "../src/contracts";

const currentAbiHash = sha1(abi);

const abisUpToDate = () => {
  const deployments = fs
    .readdirSync("deployments", { withFileTypes: true })
    .filter(dirent => dirent.isFile && dirent.name.match(/\.json$/))
    .map(dirent => dirent.name);

  for (const deploymentJson of deployments) {
    const deployment = JSON.parse(
      fs.readFileSync(path.join("deployments", deploymentJson)).toString()
    ) as LiquityDeployment;

    if (deployment.abiHash !== currentAbiHash) {
      return false;
    }
  }

  return true;
};

if (abisUpToDate()) {
  console.log("ABI matches all deployments.");
} else {
  console.error("ABI has changed since last deployment.");
  console.error("Must redeploy contracts before publishing new frontend.");
  process.exitCode = 1;
}
