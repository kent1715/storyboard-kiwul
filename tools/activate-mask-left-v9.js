const fs = require("fs");
const path = require("path");

const projectId = "cmqj0naeg0000vab0fa5wos9z";
const testDir = path.join(
  "D:\\storyboard-kiwul\\outputs\\storyboard",
  projectId,
  "inpaint_tests"
);

const src = path.join(testDir, "mask_left_tight_v9.png");
const dst = path.join(testDir, "mask_left.png");
const bak = path.join(testDir, "mask_left.before_v9.png");

if (!fs.existsSync(src)) {
  throw new Error("SOURCE_MASK_NOT_FOUND: " + src);
}

if (fs.existsSync(dst) && !fs.existsSync(bak)) {
  fs.copyFileSync(dst, bak);
}

fs.copyFileSync(src, dst);

console.log("ACTIVATE_MASK_LEFT_V9_OK");
console.log("SRC =", src);
console.log("DST =", dst);
if (fs.existsSync(bak)) {
  console.log("BACKUP =", bak);
}
