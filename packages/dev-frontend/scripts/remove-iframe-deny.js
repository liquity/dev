const { execSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync } = require("fs");

const workerFile = "workers-site/index.js"

const workerScript = readFileSync(workerFile, { encoding: "ascii" })
  .replace(`response.headers.set('X-Frame-Options', 'DENY');`, "");

writeFileSync(workerFile, workerScript);
