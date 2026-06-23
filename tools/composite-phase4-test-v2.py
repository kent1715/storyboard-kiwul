import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def load_rgba(path: Path):
    if not path.exists():
        raise RuntimeError(f"FILE_NOT_FOUND={path}")
    return Image.open(path).convert("RGBA")


def fit_height(img: Image.Image, target_height: int):
    w, h = img.size
    scale = target_height / h
    new_w = int(w * scale)
    return img.resize((new_w, target_height), Image.LANCZOS)


def soften_alpha(img: Image.Image):
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.3))
    return Image.merge("RGBA", (r, g, b, a))


def paste_center_bottom(canvas: Image.Image, layer: Image.Image, center_x: int, bottom_y: int, label: str):
    x = int(center_x - layer.width / 2)
    y = int(bottom_y - layer.height)

    print(f"{label}_LAYER_SIZE={layer.width}x{layer.height}")
    print(f"{label}_PASTE_XY={x},{y}")

    canvas.alpha_composite(layer, (x, y))
    return canvas


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/composite-phase4-test-v2.py <projectId>")
        sys.exit(1)

    project_id = sys.argv[1]
    project_root = Path("D:/storyboard-kiwul/outputs/storyboard") / project_id

    out_dir = project_root / "scenes" / "scene_001"
    ensure_dir(out_dir)

    char_a_path = project_root / "characters" / "char_A" / "alpha" / "half_body_alpha.png"
    char_b_path = project_root / "characters" / "char_B" / "alpha" / "half_body_alpha.png"

    output_path = out_dir / "composite_test_scene_001_v2_no_overlap.png"

    print("PHASE4_COMPOSITE_TEST_V2_START")
    print(f"PROJECT_ROOT={project_root}")
    print(f"CHAR_A={char_a_path}")
    print(f"CHAR_B={char_b_path}")
    print(f"OUTPUT={output_path}")

    canvas_w = 576
    canvas_h = 1024

    bg = Image.new("RGBA", (canvas_w, canvas_h), (210, 210, 210, 255))

    floor = Image.new("RGBA", (canvas_w, 270), (185, 185, 185, 255))
    bg.alpha_composite(floor, (0, canvas_h - 270))

    char_a = load_rgba(char_a_path)
    char_b = load_rgba(char_b_path)

    # Lebih kecil dari v1. V1 terlalu besar dan tumpuk.
    char_a = fit_height(char_a, 480)
    char_b = fit_height(char_b, 500)

    char_a = soften_alpha(char_a)
    char_b = soften_alpha(char_b)

    char_a = ImageEnhance.Contrast(char_a).enhance(1.02)
    char_b = ImageEnhance.Contrast(char_b).enhance(1.02)

    # Layout lebih jauh:
    # A kiri, B kanan, jarak antar center diperlebar.
    paste_center_bottom(bg, char_a, center_x=155, bottom_y=900, label="CHAR_A")
    paste_center_bottom(bg, char_b, center_x=425, bottom_y=900, label="CHAR_B")

    bg.convert("RGB").save(output_path, quality=95)

    print("PHASE4_COMPOSITE_TEST_V2_OK")
    print(f"OUTPUT={output_path}")


if __name__ == "__main__":
    main()
