const fs = require("fs");
const path = require("path");

function ensureExists(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`${label} tidak ditemukan: ${p}`);
  }
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function pickBest(files, preferredKeywords) {
  if (!files.length) return null;

  const normalized = files.map((f) => ({
    full: f,
    name: path.basename(f).toLowerCase(),
  }));

  for (const keyword of preferredKeywords) {
    const found = normalized.find((x) => x.name.includes(keyword.toLowerCase()));
    if (found) return found.full;
  }

  return normalized[0].full;
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    throw new Error("Usage: node .\\tools\\prepare-phase5c-left.js <projectId>");
  }

  const projectRoot = path.join(process.cwd(), "outputs", "storyboard", projectId);
  const inpaintDir = path.join(projectRoot, "inpaint_tests");
  const charRoot = path.join(projectRoot, "characters", "char_A");
  const platesDir = path.join(charRoot, "plates");
  const alphaDir = path.join(charRoot, "alpha");

  ensureExists(projectRoot, "Project root");
  ensureExists(inpaintDir, "Inpaint test dir");
  ensureExists(charRoot, "char_A root");
  ensureExists(platesDir, "char_A plates dir");

  const baseImage = path.join(inpaintDir, "uno_base.png");
  const leftMask = path.join(inpaintDir, "mask_left.png");

  ensureExists(baseImage, "Base image");
  ensureExists(leftMask, "Left mask");

  const plateFiles = listFilesRecursive(platesDir).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );

  const alphaFiles = listFilesRecursive(alphaDir).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );

  const halfBodyRef = pickBest(plateFiles, [
    "half_body_retry2",
    "half_body_retry1",
    "half_body",
    "dialog_plate",
    "torso",
  ]);

  const faceRef = pickBest(plateFiles, [
    "face_retry2",
    "face_retry1",
    "face_plate_v2",
    "face_plate",
    "face",
    "portrait",
  ]);

  const alphaRef = pickBest(alphaFiles, [
    "half_body",
    "original",
    "isnet",
    "alpha",
  ]);

  const positivePrompt = [
    "One young Indonesian man on the left side of the frame.",
    "This is character A.",
    "Keep the person on the right side unchanged.",
    "Head to waist framing, natural dialog shot, eye-level camera.",
    "Preserve the same face identity, hairstyle, hair color, outfit, and overall silhouette from the reference images.",
    "Natural body proportions, clean anatomy, clear face, consistent clothing details.",
    "Blend naturally into the existing room, preserve the original room lighting and background continuity.",
    "Make the left character feel naturally present in the scene, not pasted.",
    "2D semi-realistic Indonesian animation look, clean lines, soft shading, warm dim kost room lighting."
  ].join(" ");

  const negativePrompt = [
    "extra person, duplicate person, merged faces, blended identities, twin effect, face mix, wrong person,",
    "cropped head, cropped torso, missing arm, missing hand, broken anatomy, deformed body,",
    "character overlap, pasted look, floating person, hard cutout edge, dirty edge, square background,",
    "change the right character, change overall composition, extreme zoom, full body, low quality, blur"
  ].join(" ");

  const manifest = {
    projectId,
    phase: "5C_left_inpaint_prepare",
    createdAt: new Date().toISOString(),
    inputs: {
      base_image: baseImage,
      mask_left: leftMask,
      half_body_reference: halfBodyRef,
      face_reference: faceRef,
      alpha_reference: alphaRef,
    },
    prompts: {
      positive_prompt_file: path.join(inpaintDir, "phase5c_left_positive.txt"),
      negative_prompt_file: path.join(inpaintDir, "phase5c_left_negative.txt"),
    }
  };

  writeText(manifest.prompts.positive_prompt_file, positivePrompt);
  writeText(manifest.prompts.negative_prompt_file, negativePrompt);

  const manifestPath = path.join(inpaintDir, "phase5c_left_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("PHASE5C_LEFT_PREPARE_OK");
  console.log("MANIFEST=" + manifestPath);
  console.log("BASE_IMAGE=" + baseImage);
  console.log("MASK_LEFT=" + leftMask);
  console.log("HALF_BODY_REF=" + (halfBodyRef || ""));
  console.log("FACE_REF=" + (faceRef || ""));
  console.log("ALPHA_REF=" + (alphaRef || ""));
  console.log("POSITIVE_PROMPT=" + manifest.prompts.positive_prompt_file);
  console.log("NEGATIVE_PROMPT=" + manifest.prompts.negative_prompt_file);
}

main();
