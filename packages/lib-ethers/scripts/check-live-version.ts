import fs from "fs";
import path from "path";
import "colors";

import { _LiquityDeploymentJSON } from "../src/contracts";

const compareDeployedVersionsTo = (version: string) => {
  let match = true;

  const deployments = fs
    .readdirSync("deployments", { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(deploymentDir =>
      fs
        .readdirSync(path.join("deployments", deploymentDir.name), { withFileTypes: true })
        .filter(
          dirent => dirent.isFile() && dirent.name.match(/\.json$/) && dirent.name !== "dev.json"
        )
        .map(deployment => path.join("deployments", deploymentDir.name, deployment.name))
    )
    .reduce((flattenedArray, array) => flattenedArray.concat(array), []);

  for (const deploymentJson of deployments) {
    const deployment = JSON.parse(
      fs.readFileSync(deploymentJson).toString()
    ) as _LiquityDeploymentJSON;

    if (deployment.version !== version) {
      console.error(`${deploymentJson} has version ${deployment.version}`.red);
      match = false;
    }
  }

  return match;
};

const savedLiveVersion = fs.readFileSync(path.join("live", "version")).toString().trim();

console.log(`Saved live version: ${savedLiveVersion}`.cyan);

if (compareDeployedVersionsTo(savedLiveVersion)) {
  console.log("All deployments match saved version.");
} else {
  console.error(
    (
      "All deployments must have the same version, " +
      "and it must match the saved version in 'packages/lib/live/artifacts'."
    ).red
  );
  process.exitCode = 1;
}
