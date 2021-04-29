import fs from "fs";
import path from "path";

const deploymentsDir = "deployments";
const devDeploymentName = "dev.json";

const exists = (file: string) => fs.existsSync(file) && fs.lstatSync(file).isFile();

const devDeployments = () =>
  fs
    .readdirSync(deploymentsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== "backfill")
    .map(deploymentDir => path.join(deploymentsDir, deploymentDir.name, devDeploymentName))
    .concat(path.join(deploymentsDir, devDeploymentName))
    .filter(exists);

devDeployments().forEach(devDeployment => fs.unlinkSync(devDeployment));
