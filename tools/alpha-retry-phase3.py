import sys
import json
from pathlib import Path
from datetime import datetime

from PIL import Image, ImageFilter
from rembg import remove, new_session


def log(msg):
    print(msg, flush=True)


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def remove_bg_variant(input_path: Path, output_path: Path, model_name: str, alpha_matting: bool):
    ensure_dir(output_path.parent)

    img = Image.open(input_path).convert("RGBA")
    session = new_session(model_name)

    if alpha_matting:
        result = remove(
            img,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=230,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=5,
        )
    else:
        result = remove(
            img,
            session=session,
            alpha_matting=False,
        )

    if not isinstance(result, Image.Image):
        result = Image.open(result).convert("RGBA")
    else:
        result = result.convert("RGBA")

    # Rapikan alpha sedikit tanpa terlalu agresif
    r, g, b, a = result.split()
    a = a.filter(ImageFilter.MedianFilter(size=3))
    result = Image.merge("RGBA", (r, g, b, a))

    result.save(output_path)

    return {
        "model": model_name,
        "alpha_matting": alpha_matting,
        "input": str(input_path),
        "output": str(output_path),
        "output_exists": output_path.exists(),
        "output_bytes": output_path.stat().st_size if output_path.exists() else 0,
        "size": result.size,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/alpha-retry-phase3.py <projectId>")
        sys.exit(1)

    project_id = sys.argv[1]
    project_root = Path("D:/storyboard-kiwul/outputs/storyboard") / project_id
    log_dir = project_root / "logs"
    ensure_dir(log_dir)

    if not project_root.exists():
        raise RuntimeError(f"PROJECT_ROOT_NOT_FOUND={project_root}")

    jobs = [
        {
            "character_id": "char_A",
            "input": project_root / "characters" / "char_A" / "plates" / "half_body_plate.png",
            "output_dir": project_root / "characters" / "char_A" / "alpha",
        },
        {
            "character_id": "char_B",
            "input": project_root / "characters" / "char_B" / "plates" / "half_body_plate.png",
            "output_dir": project_root / "characters" / "char_B" / "alpha",
        },
    ]

    variants = [
        {"name": "u2net", "alpha_matting": True},
        {"name": "u2netp", "alpha_matting": True},
        {"name": "silueta", "alpha_matting": True},
        {"name": "isnet-general-use", "alpha_matting": False},
    ]

    log("PHASE3_ALPHA_RETRY_START")
    log(f"PROJECT_ROOT={project_root}")

    results = []

    for job in jobs:
        input_path = job["input"]

        if not input_path.exists():
            log(f"INPUT_NOT_FOUND={input_path}")
            results.append({
                "character_id": job["character_id"],
                "ok": False,
                "error": f"INPUT_NOT_FOUND={input_path}",
            })
            continue

        for variant in variants:
            safe_name = variant["name"].replace("-", "_")
            output_path = job["output_dir"] / f"half_body_alpha_retry_{safe_name}.png"

            log("")
            log("====================================")
            log(f"ALPHA_RETRY {job['character_id']} model={variant['name']}")
            log(f"INPUT={input_path}")
            log(f"OUTPUT={output_path}")
            log("====================================")

            try:
                out = remove_bg_variant(
                    input_path=input_path,
                    output_path=output_path,
                    model_name=variant["name"],
                    alpha_matting=variant["alpha_matting"],
                )
                results.append({
                    "character_id": job["character_id"],
                    "ok": True,
                    **out,
                })
                log(f"OK {job['character_id']} {variant['name']}")
                log(f"OUTPUT_BYTES={out['output_bytes']}")
            except Exception as e:
                results.append({
                    "character_id": job["character_id"],
                    "model": variant["name"],
                    "ok": False,
                    "error": str(e),
                })
                log(f"FAILED {job['character_id']} {variant['name']}")
                log(str(e))

    log_path = log_dir / f"phase3-alpha-retry-{int(datetime.now().timestamp())}.json"
    log_path.write_text(json.dumps({
        "project_id": project_id,
        "created_at": datetime.now().isoformat(),
        "results": results,
    }, indent=2), encoding="utf-8")

    log("")
    log("PHASE3_ALPHA_RETRY_OK")
    log(f"LOG={log_path}")


if __name__ == "__main__":
    main()
