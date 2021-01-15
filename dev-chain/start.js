const { spawnSync } = require("child_process");

spawnSync("docker", [
  "run",
  "-d",
  "--rm",
  ...["--name", "openethereum"],
  ...["-p", "8545:8545/tcp"],
  ...["-p", "8546:8546/tcp"],
  ...["-v", `${__dirname}:/dev-chain`],

  "openethereum/openethereum",

  ...["--config", "/dev-chain/config.toml"]
]);
