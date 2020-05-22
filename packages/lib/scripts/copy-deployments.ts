import fs from "fs";
import path from "path";

const outputDir = "deployments";
const inputDir = (channel: string) => path.join("deployments", channel);

const defaultChannel = "default";

const copyDeploymentsFrom = (channel: string) => {
  const deploymentsDir = inputDir(channel);
  const deployments = fs.readdirSync(deploymentsDir);

  for (const deployment of deployments) {
    fs.copyFileSync(path.join(deploymentsDir, deployment), path.join(outputDir, deployment));
  }
};

copyDeploymentsFrom(defaultChannel);

if (process.env.CHANNEL && process.env.CHANNEL !== defaultChannel) {
  copyDeploymentsFrom(process.env.CHANNEL);
}
