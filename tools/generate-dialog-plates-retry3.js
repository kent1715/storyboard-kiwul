const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/generate-dialog-plates-retry3.js <projectId>");
  process.exit(1);
}

const PROJECT_ROOT = path.join("D:", "storyboard-kiwul", "outputs", "storyboard", projectId);
const MANIFEST_PATH = path.join(PROJECT_ROOT, "manifests", "character-library.json");
const LOG_DIR = path.join(PROJECT_ROOT, "logs");
const API_URL = "http://127.0.0.1:9410/v1/images/generations";
const MODEL = "comfyui-full-character-sdxl";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toAbs(rel) {
  return path.join(PROJECT_ROOT, rel.replaceAll("/", "\\"));
}

function findCharacter(manifest, charId) {
  const c = manifest.characters.find((x) => x.id === charId);
  if (!c) throw new Error("Character not found: " + charId);
  return c;
}

function buildPrompt(character) {
  const gender =
    character.id === "char_A" ? "male" :
    character.id === "char_B" ? "female" :
    "character";

  return `
Create a clean single-character DIALOG PLATE from the uploaded reference image.

Exactly one ${gender} Indonesian character only.
The character must look like the same person from the reference image.
Preserve the same face identity, hairstyle, hair color, outfit design, outfit colors, body proportion, and silhouette.
Do not redesign the character.
Do not change the hairstyle.
Do not change the outfit.

IMPORTANT FRAMING:
This must be a medium half-body dialog plate, not a face portrait.
Show the character from the full top of the head down to the waist.
Full head visible.
Full hairstyle visible.
Both shoulders visible.
Chest visible.
Torso visible.
Waist visible.
Upper arms visible.
The character must be smaller in the frame.
The camera must be pulled back.
Leave empty margin above the hair, on both sides of the body, and below the waist.

Pose:
standing upright, front-facing, neutral relaxed pose, looking at camera, arms relaxed naturally.

Background:
plain clean light gray studio background only, no room, no object, no furniture, no scenery.

Lighting:
soft even studio lighting, clean readable face and clothing.

Style:
clean polished 2D semi-realistic Indonesian animation character asset, suitable for compositing into storyboard scenes.
`.trim();
}

function buildNegative() {
  return [
    "close-up",
    "extreme close-up",
    "face only",
    "headshot",
    "portrait crop",
    "bust only",
    "only head and shoulders",
    "cropped torso",
    "missing torso",
    "missing waist",
    "missing arms",
    "cropped arms",
    "cropped shoulders",
    "cropped hair",
    "hair cut off",
    "top of head cut off",
    "cropped chin",
    "shirtless",
    "bare shoulders",
    "naked shoulders",
    "changed clothes",
    "wrong outfit",
    "wrong outfit color",
    "changed hairstyle",
    "different person",
    "redesigned character",
    "multiple characters",
    "two people",
    "extra person",
    "duplicate person",
    "merged face",
    "blended identity",
    "busy background",
    "dark background",
    "black background",
    "room interior",
    "furniture",
    "props",
    "object in hand",
    "text",
    "watermark",
    "logo",
    "bad anatomy",
    "extra limbs",
    "extra fingers",
    "blurry",
    "low quality"
  ].join(", ");
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.response = json;
    throw err;
  }

  return json;
}

function extractImagePayload(json) {
  if (json?.data?.[0]?.b64_json) return { type: "b64", value: json.data[0].b64_json };
  if (json?.data?.[0]?.base64) return { type: "b64", value: json.data[0].base64 };
  if (json?.b64_json) return { type: "b64", value: json.b64_json };
  if (json?.base64) return { type: "b64", value: json.base64 };

  if (json?.data?.[0]?.path) return { type: "path", value: json.data[0].path };
  if (json?.path) return { type: "path", value: json.path };
  if (json?.output_path) return { type: "path", value: json.output_path };
  if (json?.image_path) return { type: "path", value: json.image_path };

  return null;
}

async function saveImageFromResponse(json, outPath) {
  const payload = extractImagePayload(json);

  if (!payload) {
    throw new Error("Tidak menemukan b64/path image di response proxy 9410");
  }

  if (payload.type === "b64") {
    fs.writeFileSync(outPath, Buffer.from(payload.value, "base64"));
    return;
  }

  if (payload.type === "path") {
    if (!fs.existsSync(payload.value)) {
      throw new Error("Response path tidak ditemukan: " + payload.value);
    }
    fs.copyFileSync(payload.value, outPath);
    return;
  }
}

async function generate(character) {
  const sourceRefRel = character.source_refs?.[0];
  if (!sourceRefRel) {
    console.log("SKIP " + character.id + ": no source ref");
    return null;
  }

  const sourceRefAbs = toAbs(sourceRefRel);
  const outAbs = path.join(PROJECT_ROOT, "characters", character.id, "plates", "dialog_plate_retry3.png");
  ensureDir(path.dirname(outAbs));

  const ipWeight = character.id === "char_A" ? 0.34 : 0.36;

  const body = {
    model: MODEL,
    prompt: buildPrompt(character),
    negative_prompt: buildNegative(),
    referenceImage: sourceRefAbs,
    reference_image: sourceRefAbs,
    size: "768x1024",
    steps: 36,
    cfg: 7,
    ipadapter_weight: ipWeight,
    weight_type: "style and composition"
  };

  console.log("");
  console.log("====================================");
  console.log("GENERATE_DIALOG_PLATE_RETRY3 " + character.id);
  console.log("SOURCE=" + sourceRefAbs);
  console.log("OUTPUT=" + outAbs);
  console.log("IP_WEIGHT=" + ipWeight);
  console.log("====================================");

  const started = Date.now();
  const json = await postJson(API_URL, body);
  await saveImageFromResponse(json, outAbs);

  const sec = Math.round((Date.now() - started) / 1000);
  const stat = fs.statSync(outAbs);

  console.log("OK " + character.id);
  console.log("FILE=" + outAbs);
  console.log("BYTES=" + stat.size);
  console.log("TIME_SEC=" + sec);

  return {
    character_id: character.id,
    output: outAbs,
    bytes: stat.size,
    seconds: sec
  };
}

async function main() {
  ensureDir(LOG_DIR);

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("Manifest not found: " + MANIFEST_PATH);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const results = [];

  console.log("DIALOG_PLATE_RETRY3_START");

  for (const charId of ["char_A", "char_B"]) {
    const character = findCharacter(manifest, charId);
    const result = await generate(character);
    if (result) results.push(result);
  }

  const logPath = path.join(LOG_DIR, `dialog-plates-retry3-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    project_id: projectId,
    created_at: new Date().toISOString(),
    results
  }, null, 2), "utf8");

  console.log("");
  console.log("DIALOG_PLATE_RETRY3_OK");
  console.log("LOG=" + logPath);
}

main().catch((err) => {
  console.error("");
  console.error("DIALOG_PLATE_RETRY3_FAILED");
  console.error(err && err.stack ? err.stack : err);

  if (err.response) {
    console.error("PROXY_RESPONSE:");
    console.error(JSON.stringify(err.response, null, 2));
  }

  process.exit(1);
});
