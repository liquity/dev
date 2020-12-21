import fs from "fs-extra";
import path from "path";

const artifactsDir = path.join("..", "contracts", "artifacts");
const contractsDir = path.join(artifactsDir, "contracts");
const liveDir = "live";

// *.json, except *.dbg.json
const jsonFileFilter = /(?<!\.dbg)\.json$/;

const recursivelyListFilesInDir = (dir: string): [string, string][] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(dirent =>
      dirent.isDirectory()
        ? recursivelyListFilesInDir(path.join(dir, dirent.name))
        : [[dir, dirent.name]]
    );

const jsonFiles = recursivelyListFilesInDir(contractsDir).filter(([, file]) =>
  jsonFileFilter.test(file)
);

fs.removeSync(liveDir);
fs.mkdirSync(liveDir);

fs.copyFileSync(path.join(artifactsDir, "version"), path.join(liveDir, "version"));
jsonFiles.forEach(([dir, file]) => fs.copyFileSync(path.join(dir, file), path.join(liveDir, file)));
