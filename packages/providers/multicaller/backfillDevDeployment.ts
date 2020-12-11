import fs from "fs";

const devDeployment = "multicaller/devDeployment.json";

fs.existsSync(devDeployment) || fs.writeFileSync(devDeployment, JSON.stringify(null));
