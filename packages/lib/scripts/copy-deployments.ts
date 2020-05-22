import fs from "fs";
import path from "path";

const outputDir = "deployments";
const inputDir = (channel: string) => path.join("deployments", channel);

const defaultChannel = "default";

const exists = (dir: string) => {
  return fs.existsSync(dir) && fs.lstatSync(dir).isDirectory();
};

const copyDeploymentsFrom = (deploymentsDir: string) => {
  const deployments = fs.readdirSync(deploymentsDir);

  for (const deployment of deployments) {
    fs.copyFileSync(path.join(deploymentsDir, deployment), path.join(outputDir, deployment));
  }
};

copyDeploymentsFrom(inputDir(defaultChannel));

if (process.env.CHANNEL && process.env.CHANNEL !== defaultChannel) {
  const channelDir = inputDir(process.env.CHANNEL);

  if (exists(channelDir)) {
    copyDeploymentsFrom(channelDir);
  }
}
