const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/retry2-character-plates-phase2.js <projectId>");
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

function buildPrompt(character, plateType) {
  const gender =
    character.id === "char_A" ? "male" :
    character.id === "char_B" ? "female" :
    "character";

  const common = `
Create a clean isolated single-character reference sheet from the uploaded reference image.
Exactly one ${gender} Indonesian character only.
Preserve the same face identity, hairstyle, hair color, outfit design, clothing colors, body proportion, and silhouette from the reference image.
The character must look like the same person from the reference.
Do not redesign the character.
Do not change the hairstyle.
Do not change the outfit colors.
Plain clean light gray studio background only.
No scenery, no room, no dark background, no furniture, no props.
Soft even studio lighting.
Centered composition.
Clean character asset for animation production.
`.trim();

  if (plateType === "face") {
    return `
${common}
Head-and-shoulders portrait reference sheet.
The full head and full hairstyle must be visible.
Leave clear empty margin above the hair.
Do not crop the hair, forehead, chin, neck, or shoulders.
Show neck, shoulders, and a little upper chest.
Front-facing neutral expression, looking at camera.
The background must be plain clean light gray.
`.trim();
  }

  if (plateType === "half_body") {
    return `
${common}
Medium half-body reference sheet.
The camera must be pulled back.
Show the character from the full head down to the waist.
Full head visible, full hairstyle visible, both shoulders visible.
Show chest, torso, waist, and arms.
The full outfit on the upper body must be clearly visible.
Do not create a headshot.
Do not create a close-up portrait.
The character should occupy only about 65 percent of the image height.
Leave empty space above the head and around the body.
Standing upright, front-facing, neutral pose.
`.trim();
  }

  if (plateType === "full_body") {
    return `
${common}
Full-body reference sheet.
The camera must be far enough to show the entire character.
Show the complete body from the top of the head to the bottom of both feet.
Full head visible, full hairstyle visible, torso visible, arms visible, legs visible, both feet visible.
The entire outfit from top to bottom must be clearly visible.
The character should occupy only about 80 percent of the image height.
Leave empty space above the head, on both sides, and below the feet.
Standing upright, front-facing, relaxed neutral stance, arms naturally at the sides.
This must be a full-body character turnaround style reference image, not a portrait.
`.trim();
  }

  throw new Error("Unknown plateType: " + plateType);
}

function buildNegative(plateType) {
  const base = [
    "multiple characters",
    "two people",
    "extra person",
    "duplicate person",
    "merged face",
    "blended identity",
    "different person",
    "changed hairstyle",
    "changed clothes",
    "changed outfit",
    "wrong outfit color",
    "redesigned character",
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
    "low quality",
    "blurry",
    "bad anatomy",
    "extra limbs",
    "extra fingers",
    "distorted face",
    "deformed body",
    "strong shadow",
    "dramatic lighting"
  ];

  if (plateType === "face") {
    base.push(
      "extreme close-up",
      "face only",
      "cropped head",
      "cropped hair",
      "hair cut off",
      "missing top of head",
      "cropped forehead",
      "cropped chin",
      "cropped shoulders",
      "side profile"
    );
  }

  if (plateType === "half_body") {
    base.push(
      "headshot",
      "face only",
      "close-up",
      "extreme close-up",
      "cropped shoulders",
      "cropped torso",
      "missing torso",
      "missing waist",
      "missing arms",
      "only face visible",
      "only chest visible",
      "too zoomed in"
    );
  }

  if (plateType === "full_body") {
    base.push(
      "headshot",
      "portrait",
      "close-up",
      "half body",
      "upper body only",
      "cropped body",
      "cropped legs",
      "cropped feet",
      "missing feet",
      "missing legs",
      "feet outside frame",
      "too zoomed in",
      "sitting pose",
      "action pose"
    );
  }

  return base.join(", ");
}

function ipWeight(characterId, plateType) {
  if (characterId === "char_B") {
    if (plateType === "face") return 0.58;
    if (plateType === "half_body") return 0.42;
    if (plateType === "full_body") return 0.32;
  }

  if (plateType === "face") return 0.62;
  if (plateType === "half_body") return 0.46;
  if (plateType === "full_body") return 0.30;

  return 0.40;
}

function outputName(plateType) {
  if (plateType === "face") return "face_plate_retry2.png";
  if (plateType === "half_body") return "half_body_plate_retry2.png";
  if (plateType === "full_body") return "full_body_plate_retry2.png";
  throw new Error("Unknown plateType: " + plateType);
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

async function generate(character, plateType) {
  const sourceRefRel = character.source_refs?.[0];
  if (!sourceRefRel) {
    console.log("SKIP " + character.id + ": no source ref");
    return null;
  }

  const sourceRefAbs = toAbs(sourceRefRel);
  const outAbs = path.join(PROJECT_ROOT, "characters", character.id, "plates", outputName(plateType));
  ensureDir(path.dirname(outAbs));

  const body = {
    model: MODEL,
    prompt: buildPrompt(character, plateType),
    negative_prompt: buildNegative(plateType),
    referenceImage: sourceRefAbs,
    reference_image: sourceRefAbs,
    size: "768x1024",
    steps: 34,
    cfg: 6.5,
    ipadapter_weight: ipWeight(character.id, plateType),
    weight_type: "style and composition"
  };

  console.log("");
  console.log("====================================");
  console.log(`RETRY2 ${character.id} ${plateType}`);
  console.log("SOURCE=" + sourceRefAbs);
  console.log("OUTPUT=" + outAbs);
  console.log("IP_WEIGHT=" + body.ipadapter_weight);
  console.log("====================================");

  const started = Date.now();
  const json = await postJson(API_URL, body);
  await saveImageFromResponse(json, outAbs);

  const sec = Math.round((Date.now() - started) / 1000);
  const stat = fs.statSync(outAbs);

  console.log(`OK ${character.id} ${plateType}`);
  console.log("FILE=" + outAbs);
  console.log("BYTES=" + stat.size);
  console.log("TIME_SEC=" + sec);

  return {
    character_id: character.id,
    plate_type: plateType,
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

  const retryPlan = [
    ["char_A", "full_body"],
    ["char_B", "face"],
    ["char_B", "half_body"],
    ["char_B", "full_body"]
  ];

  const results = [];

  console.log("PHASE2_RETRY2_START");

  for (const [charId, plateType] of retryPlan) {
    const character = findCharacter(manifest, charId);
    const result = await generate(character, plateType);
    if (result) results.push(result);
  }

  const logPath = path.join(LOG_DIR, `phase2-retry2-plates-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    project_id: projectId,
    created_at: new Date().toISOString(),
    results
  }, null, 2), "utf8");

  console.log("");
  console.log("PHASE2_RETRY2_OK");
  console.log("LOG=" + logPath);
}

main().catch((err) => {
  console.error("");
  console.error("PHASE2_RETRY2_FAILED");
  console.error(err && err.stack ? err.stack : err);

  if (err.response) {
    console.error("PROXY_RESPONSE:");
    console.error(JSON.stringify(err.response, null, 2));
  }

  process.exit(1);
});
