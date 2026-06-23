const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/create-character-library-manifest.js <projectId>");
  process.exit(1);
}

const projectRoot = path.join(
  "D:",
  "storyboard-kiwul",
  "outputs",
  "storyboard",
  projectId
);

const charactersRoot = path.join(projectRoot, "characters");
const manifestsRoot = path.join(projectRoot, "manifests");
const outFile = path.join(manifestsRoot, "character-library.json");

function existsRel(relPath) {
  const abs = path.join(projectRoot, relPath);
  return fs.existsSync(abs);
}

function findSourceRefs(charId) {
  const dir = path.join(charactersRoot, charId, "source");
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .sort()
    .map((name) => `characters/${charId}/source/${name}`.replaceAll("\\", "/"));
}

function makeCharacter(charId, displayName, roleHint) {
  const sourceRefs = findSourceRefs(charId);

  const plates = {
    face: `characters/${charId}/plates/face_plate.png`,
    half_body: `characters/${charId}/plates/half_body_plate.png`,
    full_body: `characters/${charId}/plates/full_body_plate.png`
  };

  const alphaPlates = {
    face: `characters/${charId}/alpha/face_alpha.png`,
    half_body: `characters/${charId}/alpha/half_body_alpha.png`,
    full_body: `characters/${charId}/alpha/full_body_alpha.png`
  };

  return {
    id: charId,
    name: displayName,
    role_hint: roleHint,
    status: sourceRefs.length ? "source_ready" : "empty",
    style: "2D semi-realistic Indonesian animation",
    source_refs: sourceRefs,
    identity_notes: {
      gender: "",
      age_visual: "",
      body_type: "",
      height_class: "",
      face: "",
      hair: "",
      outfit: "",
      colors: [],
      unique_marks: ""
    },
    plates,
    alpha_plates: alphaPlates,
    plate_status: {
      face: existsRel(plates.face) ? "ready" : "missing",
      half_body: existsRel(plates.half_body) ? "ready" : "missing",
      full_body: existsRel(plates.full_body) ? "ready" : "missing"
    },
    alpha_status: {
      face: existsRel(alphaPlates.face) ? "ready" : "missing",
      half_body: existsRel(alphaPlates.half_body) ? "ready" : "missing",
      full_body: existsRel(alphaPlates.full_body) ? "ready" : "missing"
    },
    defaults: {
      scene_plate: "half_body",
      closeup_plate: "face",
      wide_plate: "full_body"
    },
    notes: ""
  };
}

function main() {
  if (!fs.existsSync(projectRoot)) {
    console.error("PROJECT_ROOT_NOT_FOUND=" + projectRoot);
    process.exit(1);
  }

  fs.mkdirSync(manifestsRoot, { recursive: true });

  const manifest = {
    version: 1,
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    character_count_target: 4,
    characters: [
      makeCharacter("char_A", "Character A", "main_character"),
      makeCharacter("char_B", "Character B", "main_character"),
      makeCharacter("char_C", "Character C", "supporting_character"),
      makeCharacter("char_D", "Character D", "supporting_character")
    ],
    production_rules: {
      one_character_default_provider: "9410_full_character",
      two_character_experimental_provider: "UNO_or_9411",
      three_four_character_default_provider: "asset_composite_pipeline",
      identity_priority: "character_library_first",
      composite_required_for_character_count_gte: 3
    }
  };

  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), "utf8");

  console.log("CHARACTER_LIBRARY_MANIFEST_OK");
  console.log("PROJECT_ROOT=" + projectRoot);
  console.log("OUT_FILE=" + outFile);

  for (const c of manifest.characters) {
    console.log(`${c.id}: ${c.status} | refs=${c.source_refs.length}`);
  }
}

main();
