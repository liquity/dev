const { execSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync } = require("fs");

const envVar = "REACT_APP_VERSION";
const envVarPattern = new RegExp(`^${envVar}=.*`);

const getCommitHash = () => {
  try {
    return execSync("git rev-parse HEAD", { encoding: "ascii" }).trim();
  } catch {
    return "unknown";
  }
};

const commitHash = getCommitHash();
let dotenv = [`${envVar}=${commitHash}`];

if (existsSync(".env")) {
  const originalDotenv = readFileSync(".env", { encoding: "ascii" }).split("\n");

  if (originalDotenv[originalDotenv.length - 1] === "") {
    originalDotenv.pop();
  }

  if (originalDotenv.some(line => line.match(envVarPattern))) {
    dotenv = originalDotenv.map(line => line.replace(envVarPattern, dotenv[0]));
  } else {
    dotenv = [...originalDotenv, ...dotenv];
  }
}

writeFileSync(".env", [...dotenv, ""].join("\n"));
