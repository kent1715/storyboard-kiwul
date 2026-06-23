const fs = require("fs");

const workflowPath = "D:/storyboard-kiwul/workflows/image_qwen_image_edit_2509.json";

if (!fs.existsSync(workflowPath)) {
  console.error("WORKFLOW_NOT_FOUND=" + workflowPath);
  process.exit(1);
}

const raw = fs.readFileSync(workflowPath, "utf8");
const prompt = JSON.parse(raw);

const targetTypes = new Set([
  "LoadImage",
  "ImageScaleToTotalPixels",
  "TextEncodeQwenImageEditPlus",
  "VAEEncode",
  "UnetLoaderGGUF",
  "LoraLoaderModelOnly",
  "ModelSamplingAuraFlow",
  "CFGNorm",
  "KSampler",
  "VAEDecode",
  "SaveImage",
  "CLIPLoader",
  "VAELoader"
]);

console.log("WORKFLOW_NODE_SUMMARY_START");

for (const [id, node] of Object.entries(prompt)) {
  if (!node || !node.class_type) continue;

  if (targetTypes.has(node.class_type)) {
    console.log("========================================");
    console.log("NODE_ID=" + id);
    console.log("CLASS=" + node.class_type);
    console.log("INPUTS=");
    console.log(JSON.stringify(node.inputs || {}, null, 2));
  }
}

console.log("WORKFLOW_NODE_SUMMARY_END");