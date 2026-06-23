const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/generate-character-plates-phase2.js <projectId>");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toAbs(rel) {
  return path.join(PROJECT_ROOT, rel.replaceAll("/", "\\"));
}

function normalizePath(p) {
  return p.replaceAll("\\", "/");
}

function getGenderHint(character) {
  const raw = [
    character.identity_notes?.gender,
    character.role_hint,
    character.name,
    character.id
  ].filter(Boolean).join(" ").toLowerCase();

  if (raw.includes("female") || raw.includes("woman") || raw.includes("girl") || raw.includes("perempuan")) return "female";
  if (raw.includes("male") || raw.includes("man") || raw.includes("boy") || raw.includes("pria") || raw.includes("laki")) return "male";

  if (character.id === "char_A") return "male";
  if (character.id === "char_B") return "female";

  return "character";
}

function styleLine(character) {
  return character.style || "2D semi-realistic Indonesian animation";
}

function buildPrompt(character, plateType) {
  const gender = getGenderHint(character);
  const style = styleLine(character);

  const identityNotes = character.identity_notes || {};
  const hair = identityNotes.hair ? ` Hair: ${identityNotes.hair}.` : "";
  const outfit = identityNotes.outfit ? ` Outfit: ${identityNotes.outfit}.` : "";
  const face = identityNotes.face ? ` Face: ${identityNotes.face}.` : "";

  const common = [
    `Create a clean single-character reference plate based on the uploaded reference image.`,
    `Show exactly one ${gender} Indonesian character only.`,
    `Preserve the same face identity, hairstyle, hair color, outfit design, clothing colors, body proportion, and silhouette from the reference image.`,
    `Do not redesign the character.`,
    `Keep the character clearly recognizable as the same person.`,
    face,
    hair,
    outfit,
    `Style: ${style}.`,
    `Clean polished character plate, centered composition, plain neutral light gray studio background, soft even studio lighting, clear separation from background, no props, no furniture, no other person.`
  ].join(" ");

  if (plateType === "face") {
    return [
      common,
      `Framing: head-and-shoulders portrait, full head visible, full hairstyle visible, hair not cropped, forehead visible, ears visible if possible, neck and shoulders visible, upper chest slightly visible, front-facing, neutral expression, looking at camera.`
    ].join(" ");
  }

  if (plateType === "half_body") {
    return [
      common,
      `Framing: half-body portrait from the top of the head down to the waist, full upper torso visible, shoulders fully visible, arms relaxed naturally, waist clearly visible, standing upright, front-facing, neutral pose, looking at camera.`
    ].join(" ");
  }

  if (plateType === "full_body") {
    return [
      common,
      `Framing: full body from head to toe, both feet completely visible, full silhouette clearly visible, standing upright, front-facing, relaxed neutral stance, arms naturally at the sides, enough empty space around the body, no cropped limbs, no cropped feet.`
    ].join(" ");
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
    "twin",
    "clone",
    "changed face",
    "different person",
    "changed hairstyle",
    "changed clothes",
    "redesigned character",
    "different outfit",
    "busy background",
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
    "extra fingers",
    "extra limbs",
    "distorted face",
    "deformed body",
    "strong shadow",
    "harsh lighting"
  ];

  if (plateType === "face") {
    base.push(
      "extreme close-up",
      "face only",
      "cropped head",
      "cropped hair",
      "hair cut off",
      "missing top of head",
      "cropped chin",
      "cropped shoulders",
      "side profile",
      "turned away"
    );
  }

  if (plateType === "half_body") {
    base.push(
      "face only",
      "headshot only",
      "extreme close-up",
      "cropped torso",
      "missing shoulders",
      "missing arms",
      "full body too far",
      "cropped waist"
    );
  }

  if (plateType === "full_body") {
    base.push(
      "headshot",
      "close-up",
      "half body",
      "cropped body",
      "cropped feet",
      "missing feet",
      "missing legs",
      "cut off legs",
      "sitting pose",
      "action pose",
      "dramatic pose"
    );
  }

  return base.join(", ");
}

function plateSize(plateType) {
  if (plateType === "face") return "768x1024";
  if (plateType === "half_body") return "768x1024";
  if (plateType === "full_body") return "768x1024";
  return "768x1024";
}

function ipWeight(plateType) {
  if (plateType === "face") return 0.78;
  if (plateType === "half_body") return 0.70;
  if (plateType === "full_body") return 0.62;
  return 0.70;
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

  if (json?.data?.[0]?.url) return { type: "url", value: json.data[0].url };
  if (json?.url) return { type: "url", value: json.url };

  return null;
}

async function saveImageFromResponse(json, outPath) {
  const payload = extractImagePayload(json);

  if (!payload) {
    throw new Error("Tidak menemukan b64/path/url image di response proxy 9410");
  }

  if (payload.type === "b64") {
    fs.writeFileSync(outPath, Buffer.from(payload.value, "base64"));
    return;
  }

  if (payload.type === "path") {
    const src = payload.value;
    if (!fs.existsSync(src)) {
      throw new Error(`Response path tidak ditemukan: ${src}`);
    }
    fs.copyFileSync(src, outPath);
    return;
  }

  if (payload.type === "url") {
    const res = await fetch(payload.value);
    if (!res.ok) throw new Error(`Gagal download image url: ${res.status}`);
    const arr = await res.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(arr));
    return;
  }

  throw new Error(`Unsupported payload type: ${payload.type}`);
}

async function generatePlate(character, plateType) {
  const sourceRefRel = character.source_refs?.[0];
  if (!sourceRefRel) {
    console.log(`SKIP ${character.id} ${plateType}: no source reference`);
    return { skipped: true, reason: "no_source_ref" };
  }

  const sourceRefAbs = toAbs(sourceRefRel);
  if (!fs.existsSync(sourceRefAbs)) {
    throw new Error(`Source ref missing for ${character.id}: ${sourceRefAbs}`);
  }

  const outRel = character.plates[plateType];
  const outAbs = toAbs(outRel);
  ensureDir(path.dirname(outAbs));

  const prompt = buildPrompt(character, plateType);
  const negative_prompt = buildNegative(plateType);

  const body = {
    model: MODEL,
    prompt,
    negative_prompt,
    referenceImage: sourceRefAbs,
    reference_image: sourceRefAbs,
    size: plateSize(plateType),
    steps: 30,
    cfg: 6,
    ipadapter_weight: ipWeight(plateType),
    weight_type: "style and composition"
  };

  console.log("");
  console.log("=========================================");
  console.log(`GENERATE ${character.id} ${plateType}`);
  console.log("SOURCE=" + sourceRefAbs);
  console.log("OUTPUT=" + outAbs);
  console.log("SIZE=" + body.size);
  console.log("IP_WEIGHT=" + body.ipadapter_weight);
  console.log("=========================================");

  const started = Date.now();
  const json = await postJson(API_URL, body);

  await saveImageFromResponse(json, outAbs);

  const ms = Date.now() - started;
  const stat = fs.statSync(outAbs);

  console.log(`OK ${character.id} ${plateType}: ${outAbs}`);
  console.log(`SIZE_BYTES=${stat.size}`);
  console.log(`TIME_SEC=${Math.round(ms / 1000)}`);

  return {
    skipped: false,
    output: normalizePath(path.relative(PROJECT_ROOT, outAbs)),
    bytes: stat.size,
    seconds: Math.round(ms / 1000)
  };
}

function updateManifestStatuses(manifest) {
  manifest.updated_at = new Date().toISOString();

  for (const c of manifest.characters) {
    if (!c.plates || !c.alpha_plates) continue;

    c.plate_status = {
      face: fs.existsSync(toAbs(c.plates.face)) ? "ready" : "missing",
      half_body: fs.existsSync(toAbs(c.plates.half_body)) ? "ready" : "missing",
      full_body: fs.existsSync(toAbs(c.plates.full_body)) ? "ready" : "missing"
    };

    c.alpha_status = {
      face: fs.existsSync(toAbs(c.alpha_plates.face)) ? "ready" : "missing",
      half_body: fs.existsSync(toAbs(c.alpha_plates.half_body)) ? "ready" : "missing",
      full_body: fs.existsSync(toAbs(c.alpha_plates.full_body)) ? "ready" : "missing"
    };

    if (c.source_refs?.length && Object.values(c.plate_status).every((x) => x === "ready")) {
      c.status = "plates_ready";
    } else if (c.source_refs?.length) {
      c.status = "source_ready";
    } else {
      c.status = "empty";
    }
  }
}

async function main() {
  ensureDir(LOG_DIR);

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const results = [];

  const targetChars = manifest.characters.filter((c) => c.source_refs?.length);

  if (!targetChars.length) {
    throw new Error("Tidak ada karakter dengan source reference");
  }

  console.log("PHASE2_PLATE_GENERATION_START");
  console.log("PROJECT_ROOT=" + PROJECT_ROOT);
  console.log("TARGET_CHARS=" + targetChars.map((c) => c.id).join(", "));

  for (const character of targetChars) {
    for (const plateType of ["face", "half_body", "full_body"]) {
      try {
        const result = await generatePlate(character, plateType);
        results.push({
          character_id: character.id,
          plate_type: plateType,
          ok: !result.skipped,
          ...result
        });

        await sleep(500);
      } catch (err) {
        console.error(`FAILED ${character.id} ${plateType}`);
        console.error(err && err.stack ? err.stack : err);

        if (err.response) {
          console.error("PROXY_RESPONSE:");
          console.error(JSON.stringify(err.response, null, 2));
        }

        results.push({
          character_id: character.id,
          plate_type: plateType,
          ok: false,
          error: String(err.message || err)
        });

        throw err;
      }
    }
  }

  updateManifestStatuses(manifest);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  const logPath = path.join(LOG_DIR, `phase2-generate-character-plates-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    project_id: projectId,
    created_at: new Date().toISOString(),
    results
  }, null, 2), "utf8");

  console.log("");
  console.log("PHASE2_PLATE_GENERATION_OK");
  console.log("LOG=" + logPath);
}

main().catch((err) => {
  console.error("");
  console.error("PHASE2_PLATE_GENERATION_FAILED");
  console.error(err && err.stack ? err.stack : err);

  if (err.response) {
    console.error("PROXY_RESPONSE:");
    console.error(JSON.stringify(err.response, null, 2));
  }

  process.exit(1);
});
