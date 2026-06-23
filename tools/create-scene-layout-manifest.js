const fs = require("fs");
const path = require("path");

const projectId = process.argv[2];

if (!projectId) {
  console.error("Usage: node tools/create-scene-layout-manifest.js <projectId>");
  process.exit(1);
}

const projectRoot = path.join(
  "D:",
  "storyboard-kiwul",
  "outputs",
  "storyboard",
  projectId
);

const manifestsRoot = path.join(projectRoot, "manifests");
const outFile = path.join(manifestsRoot, "scene-layouts.json");

function main() {
  fs.mkdirSync(manifestsRoot, { recursive: true });

  const manifest = {
    version: 1,
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    layout_presets: {
      one_character_center: [
        {
          character_id: "char_A",
          slot: "center_foreground",
          x: 0.50,
          y: 0.72,
          scale: 1.00,
          z_index: 3
        }
      ],
      two_characters_dialog: [
        {
          character_id: "char_A",
          slot: "left_foreground",
          x: 0.30,
          y: 0.72,
          scale: 1.00,
          z_index: 3
        },
        {
          character_id: "char_B",
          slot: "right_foreground",
          x: 0.70,
          y: 0.72,
          scale: 1.00,
          z_index: 3
        }
      ],
      three_characters_triangle: [
        {
          character_id: "char_A",
          slot: "left_foreground",
          x: 0.24,
          y: 0.74,
          scale: 1.00,
          z_index: 4
        },
        {
          character_id: "char_B",
          slot: "right_foreground",
          x: 0.76,
          y: 0.74,
          scale: 1.00,
          z_index: 4
        },
        {
          character_id: "char_C",
          slot: "center_midground",
          x: 0.50,
          y: 0.66,
          scale: 0.86,
          z_index: 2
        }
      ],
      four_characters_group: [
        {
          character_id: "char_A",
          slot: "left_foreground",
          x: 0.18,
          y: 0.74,
          scale: 0.95,
          z_index: 4
        },
        {
          character_id: "char_B",
          slot: "center_left_foreground",
          x: 0.40,
          y: 0.75,
          scale: 1.00,
          z_index: 5
        },
        {
          character_id: "char_C",
          slot: "center_right_foreground",
          x: 0.62,
          y: 0.75,
          scale: 1.00,
          z_index: 5
        },
        {
          character_id: "char_D",
          slot: "right_foreground",
          x: 0.84,
          y: 0.74,
          scale: 0.95,
          z_index: 4
        }
      ]
    },
    scene_overrides: {}
  };

  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), "utf8");

  console.log("SCENE_LAYOUT_MANIFEST_OK");
  console.log("OUT_FILE=" + outFile);
  console.log("PRESETS=" + Object.keys(manifest.layout_presets).join(", "));
}

main();
