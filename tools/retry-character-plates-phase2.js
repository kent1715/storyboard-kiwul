const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/retry-character-plates-phase2.js <projectId>");
  process.exit(1);
}

const PROJECT_ROOT = path.join(
  "D:",
  "storyboard-kiwul",
  "outputs",
  "storyboard",
  projectId
);

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
  if (!c) throw new Error(`Character not found: ${charId}`);
  return c;
}

function buildPrompt(character, plateType) {
  const gender =
    character.id === "char_A" ? "male" :
    character.id === "char_B" ? "female" :
    "character";

  const style = character.style || "2D semi-realistic Indonesian animation";

  const common = `
Create a clean single-character reference plate from the uploaded reference image.
Show exactly one ${gender} Indonesian character only.
Preserve the same face identity, hairstyle, hair color, outfit design, clothing colors, body proportion, and silhouette from the reference image.
Do not redesign the character.
Do not change the outfit.
Do not change the hairstyle.
Plain clean light gray studio background.
Soft even studio lighting.
Centered composition.
Clear separation from background.
No props.
No furniture.
No other person.
Style: ${style}.
`.trim();

  if (plateType === "face") {
    return `
${common}
Framing must be head-and-shoulders portrait.
Full head must be visible.
Full hairstyle must be visible.
Hair must not be cropped.
Top of head must not be cropped.
Forehead, chin, neck, shoulders, and upper chest must be visible.
Leave empty margin above the hair and around the shoulders.
Front-facing neutral expression, looking at camera.
Clean character identity reference plate.
`.trim();
  }

  if (plateType === "half_body") {
    return `
${common}
Framing must show the character from full head down to the waist.
Full head visible.
Full hairstyle visible.
Both shoulders visible.
Chest, torso, waist, and arms visible.
Do not make a close-up portrait.
Do not crop the torso.
The character must be smaller in frame than a face portrait.
Standing upright, front-facing, neutral pose, looking at camera.
Clean half-body character reference plate.
`.trim();
  }

  if (plateType === "full_body") {
    return `
${common}
Framing must show the full body from head to toe.
Full head visible.
Full hairstyle visible.
Torso, arms, legs, and both feet completely visible.
Shoes or feet must be visible.
Do not crop the body.
Do not crop the legs.
Do not crop the feet.
The character must be smaller in frame with empty space around the entire body.
Standing upright, front-facing, relaxed neutral stance, arms naturally at the sides.
Clean full-body character reference plate.
`.trim();
  }

  throw new Error(`Unknown plateType: ${plateType}`);
}

function buildNegative(plateType) {
  const base = [
    "multiple characters",
    "two people",
    "extra person",
    "duplicate person",
    "merged face",
    "blended identity",
    "changed face",
    "different person",
    "changed hairstyle",
    "changed outfit",
    "redesigned character",
    "busy background",
    "dark background",
    "room interior",
    "furniture",
    "props",
    "text",
    "watermark",
    "logo",
    "low quality",
    "blurry",
    "bad anatomy",
    "extra limbs",
    "distorted face",
    "deformed body",
    "harsh lighting",
    "strong shadow"
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
      "busy background",
      "dark background"
    );
  }

  if (plateType === "half_body") {
    base.push(
      "headshot",
      "face only",
      "extreme close-up",
      "cropped shoulders",
      "cropped torso",
      "missing torso",
      "missing waist",
      "cropped arms",
      "full body too far"
    );
  }

  if (plateType === "full_body") {
    base.push(
      "headshot",
      "close-up",
      "portrait crop",
      "half body",
      "cropped body",
      "cropped legs",
      "cropped feet",
      "missing feet",
      "missing legs",
      "sitting pose",
      "action pose",
      "dramatic pose"
    );
  }

  return base.join(", ");
}

function ipWeight(plateType) {
  if (plateType === "face") return 0.68;
  if (plateType === "half_body") return 0.58;
  if (plateType === "full_body") return 0.48;
  return 0.58;
}

function outputName(plateType) {
  if (plateType === "face") return "face_plate_retry1.png";
  if (plateType === "half_body") return "half_body_plate_retry1.png";
  if (plateType === "full_body") return "full_body_plate_retry1.png";
  throw new Error(`Unknown plateType: ${plateType}`);
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
      throw new Error(`Response path tidak ditemukan: ${payload.value}`);
    }
    fs.copyFileSync(payload.value, outPath);
    return;
  }
}

async function generate(character, plateType) {
  const sourceRefRel = character.source_refs?.[0];
  if (!sourceRefRel) {
    console.log(`SKIP ${character.id}: no source ref`);
    return;
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
    steps: 32,
    cfg: 6,
    ipadapter_weight: ipWeight(plateType),
    weight_type: "style and composition"
  };

  console.log("");
  console.log("====================================");
  console.log(`RETRY ${character.id} ${plateType}`);
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
  console.log(`FILE=${outAbs}`);
  console.log(`BYTES=${stat.size}`);
  console.log(`TIME_SEC=${sec}`);

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
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  const retryPlan = [
    ["char_A", "half_body"],
    ["char_A", "full_body"],
    ["char_B", "face"],
    ["char_B", "half_body"],
    ["char_B", "full_body"]
  ];

  const results = [];

  console.log("PHASE2_RETRY_START");

  for (const [charId, plateType] of retryPlan) {
    const character = findCharacter(manifest, charId);
    const result = await generate(character, plateType);
    results.push(result);
  }

  const logPath = path.join(LOG_DIR, `phase2-retry-plates-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    project_id: projectId,
    created_at: new Date().toISOString(),
    results
  }, null, 2), "utf8");

  console.log("");
  console.log("PHASE2_RETRY_OK");
  console.log("LOG=" + logPath);
}

main().catch((err) => {
  console.error("");
  console.error("PHASE2_RETRY_FAILED");
  console.error(err && err.stack ? err.stack : err);

  if (err.response) {
    console.error("PROXY_RESPONSE:");
    console.error(JSON.stringify(err.response, null, 2));
  }

  process.exit(1);
});
