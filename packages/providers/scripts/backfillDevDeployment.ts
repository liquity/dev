import fs from "fs";

const devDeployment = "devDeployment.json";

fs.existsSync(devDeployment) || fs.writeFileSync(devDeployment, JSON.stringify(null));
