const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/update-character-library-status-phase2.js <projectId>");
  process.exit(1);
}

const PROJECT_ROOT = path.join("D:", "storyboard-kiwul", "outputs", "storyboard", projectId);
const MANIFEST_PATH = path.join(PROJECT_ROOT, "manifests", "character-library.json");

function existsRel(relPath) {
  return fs.existsSync(path.join(PROJECT_ROOT, relPath.replaceAll("/", "\\")));
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("MANIFEST_NOT_FOUND=" + MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  for (const c of manifest.characters) {
    if (!c.plates || !c.alpha_plates) continue;

    c.plate_status = {
      face: existsRel(c.plates.face) ? "ready" : "missing",
      half_body: existsRel(c.plates.half_body) ? "ready" : "missing",
      full_body: existsRel(c.plates.full_body) ? "ready" : "missing"
    };

    c.alpha_status = {
      face: existsRel(c.alpha_plates.face) ? "ready" : "missing",
      half_body: existsRel(c.alpha_plates.half_body) ? "ready" : "missing",
      full_body: existsRel(c.alpha_plates.full_body) ? "ready" : "missing"
    };

    const faceReady = c.plate_status.face === "ready";
    const halfReady = c.plate_status.half_body === "ready";
    const fullReady = c.plate_status.full_body === "ready";

    if (faceReady && halfReady && fullReady) {
      c.status = "plates_ready";
    } else if (faceReady && halfReady) {
      c.status = "dialog_plates_ready";
    } else if (c.source_refs?.length) {
      c.status = "source_ready";
    } else {
      c.status = "empty";
    }

    c.notes = c.notes || "";
    if ((c.id === "char_A" || c.id === "char_B") && !fullReady) {
      c.notes = "Face and half-body plates are usable for storyboard/dialog scenes. Full-body plate still needs separate strategy.";
    }
  }

  manifest.updated_at = new Date().toISOString();

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log("PHASE2_STATUS_UPDATE_OK");
  for (const c of manifest.characters) {
    console.log(`${c.id}: ${c.status} | face=${c.plate_status.face} | half=${c.plate_status.half_body} | full=${c.plate_status.full_body}`);
  }
}

main();
