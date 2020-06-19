import fs from "fs-extra";
import path from "path";

fs.removeSync("live");
fs.mkdirSync("live");

["artifacts", "cache"].forEach(dir =>
  fs.copySync(path.join("..", "contracts", dir), path.join("live", dir))
);
