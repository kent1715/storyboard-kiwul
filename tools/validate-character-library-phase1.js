const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/validate-character-library-phase1.js <projectId>");
  process.exit(1);
}

const projectRoot = path.join(
  "D:",
  "storyboard-kiwul",
  "outputs",
  "storyboard",
  projectId
);

const requiredDirs = [
  "characters",
  "manifests",
  "scenes",
  "intermediate",
  "final",
  "logs",
  "characters/char_A/source",
  "characters/char_A/plates",
  "characters/char_A/alpha",
  "characters/char_B/source",
  "characters/char_B/plates",
  "characters/char_B/alpha",
  "characters/char_C/source",
  "characters/char_C/plates",
  "characters/char_C/alpha",
  "characters/char_D/source",
  "characters/char_D/plates",
  "characters/char_D/alpha"
];

const requiredFiles = [
  "manifests/character-library.json",
  "manifests/scene-layouts.json"
];

function exists(rel) {
  return fs.existsSync(path.join(projectRoot, rel));
}

function main() {
  console.log("PROJECT_ROOT=" + projectRoot);

  let ok = true;

  console.log("");
  console.log("DIRECTORY_CHECK");
  for (const dir of requiredDirs) {
    const pass = exists(dir);
    console.log(`${pass ? "OK " : "MISS"} ${dir}`);
    if (!pass) ok = false;
  }

  console.log("");
  console.log("FILE_CHECK");
  for (const file of requiredFiles) {
    const pass = exists(file);
    console.log(`${pass ? "OK " : "MISS"} ${file}`);
    if (!pass) ok = false;
  }

  console.log("");
  console.log("SOURCE_REF_CHECK");
  for (const charId of ["char_A", "char_B", "char_C", "char_D"]) {
    const sourceDir = path.join(projectRoot, "characters", charId, "source");
    const files = fs.existsSync(sourceDir)
      ? fs.readdirSync(sourceDir).filter((x) => /\.(png|jpg|jpeg|webp)$/i.test(x))
      : [];
    console.log(`${charId}: ${files.length} source image(s)`);
  }

  console.log("");
  if (!ok) {
    console.log("PHASE1_VALIDATE_FAILED");
    process.exit(1);
  }

  console.log("PHASE1_VALIDATE_OK");
}

main();
