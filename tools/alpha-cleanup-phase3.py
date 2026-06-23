import sys
import json
from pathlib import Path
from datetime import datetime

from PIL import Image
from rembg import remove, new_session


def log(msg):
    print(msg, flush=True)


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def remove_bg(input_path: Path, output_path: Path, session):
    ensure_dir(output_path.parent)

    img = Image.open(input_path).convert("RGBA")

    # rembg menghasilkan PNG RGBA dengan alpha
    result = remove(
        img,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )

    if not isinstance(result, Image.Image):
        result = Image.open(result).convert("RGBA")
    else:
        result = result.convert("RGBA")

    result.save(output_path)

    return {
        "input": str(input_path),
        "output": str(output_path),
        "input_exists": input_path.exists(),
        "output_exists": output_path.exists(),
        "output_bytes": output_path.stat().st_size if output_path.exists() else 0,
        "size": result.size,
    }


def update_manifest(project_root: Path, manifest_path: Path):
    if not manifest_path.exists():
        log(f"MANIFEST_NOT_FOUND={manifest_path}")
        return

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    for c in manifest.get("characters", []):
        alpha_plates = c.get("alpha_plates") or {}

        c["alpha_status"] = {
            "face": "ready" if (project_root / alpha_plates.get("face", "")).exists() else "missing",
            "half_body": "ready" if (project_root / alpha_plates.get("half_body", "")).exists() else "missing",
            "full_body": "ready" if (project_root / alpha_plates.get("full_body", "")).exists() else "missing",
        }

    manifest["updated_at"] = datetime.now().isoformat()

    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/alpha-cleanup-phase3.py <projectId>")
        sys.exit(1)

    project_id = sys.argv[1]
    project_root = Path("D:/storyboard-kiwul/outputs/storyboard") / project_id
    manifest_path = project_root / "manifests" / "character-library.json"
    log_dir = project_root / "logs"
    ensure_dir(log_dir)

    if not project_root.exists():
        raise RuntimeError(f"PROJECT_ROOT_NOT_FOUND={project_root}")

    jobs = [
        {
            "character_id": "char_A",
            "plate_type": "half_body",
            "input": project_root / "characters" / "char_A" / "plates" / "half_body_plate.png",
            "output": project_root / "characters" / "char_A" / "alpha" / "half_body_alpha.png",
        },
        {
            "character_id": "char_B",
            "plate_type": "half_body",
            "input": project_root / "characters" / "char_B" / "plates" / "half_body_plate.png",
            "output": project_root / "characters" / "char_B" / "alpha" / "half_body_alpha.png",
        },
    ]

    log("PHASE3_ALPHA_CLEANUP_START")
    log(f"PROJECT_ROOT={project_root}")

    # u2net_human_seg biasanya lebih cocok untuk orang/manusia
    session = new_session("u2net_human_seg")

    results = []

    for job in jobs:
        input_path = job["input"]
        output_path = job["output"]

        log("")
        log("====================================")
        log(f"ALPHA {job['character_id']} {job['plate_type']}")
        log(f"INPUT={input_path}")
        log(f"OUTPUT={output_path}")
        log("====================================")

        if not input_path.exists():
            result = {
                "character_id": job["character_id"],
                "plate_type": job["plate_type"],
                "ok": False,
                "error": f"INPUT_NOT_FOUND={input_path}",
            }
            log(result["error"])
            results.append(result)
            continue

        try:
            out = remove_bg(input_path, output_path, session)
            result = {
                "character_id": job["character_id"],
                "plate_type": job["plate_type"],
                "ok": True,
                **out,
            }
            results.append(result)
            log(f"OK {job['character_id']} {job['plate_type']}")
            log(f"OUTPUT_BYTES={result['output_bytes']}")
        except Exception as e:
            result = {
                "character_id": job["character_id"],
                "plate_type": job["plate_type"],
                "ok": False,
                "error": str(e),
            }
            results.append(result)
            log(f"FAILED {job['character_id']} {job['plate_type']}")
            log(str(e))
            raise

    update_manifest(project_root, manifest_path)

    log_path = log_dir / f"phase3-alpha-cleanup-{int(datetime.now().timestamp())}.json"
    log_path.write_text(json.dumps({
        "project_id": project_id,
        "created_at": datetime.now().isoformat(),
        "results": results,
    }, indent=2), encoding="utf-8")

    log("")
    log("PHASE3_ALPHA_CLEANUP_OK")
    log(f"LOG={log_path}")


if __name__ == "__main__":
    main()
