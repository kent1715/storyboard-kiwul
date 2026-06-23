import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def make_mask(size, box, blur=12):
    w, h = size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle(box, fill=255)

    if blur > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))

    return mask


def overlay_mask(base, mask, color):
    base = base.convert("RGBA")
    overlay = Image.new("RGBA", base.size, color)
    alpha = mask.point(lambda p: int(p * 0.45))
    overlay.putalpha(alpha)
    out = Image.alpha_composite(base, overlay)
    return out


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/make-slot-masks-phase5b.py <projectId>")
        sys.exit(1)

    project_id = sys.argv[1]
    project_root = Path("D:/storyboard-kiwul/outputs/storyboard") / project_id
    test_dir = project_root / "inpaint_tests"
    ensure_dir(test_dir)

    base_path = test_dir / "uno_base.png"
    if not base_path.exists():
        raise RuntimeError(f"BASE_IMAGE_NOT_FOUND={base_path}")

    base = Image.open(base_path).convert("RGBA")
    w, h = base.size

    print("PHASE5B_MAKE_SLOT_MASKS_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    left_box = (
        int(w * 0.03),
        int(h * 0.05),
        int(w * 0.52),
        int(h * 0.98),
    )

    right_box = (
        int(w * 0.48),
        int(h * 0.05),
        int(w * 0.97),
        int(h * 0.98),
    )

    left_mask = make_mask((w, h), left_box, blur=10)
    right_mask = make_mask((w, h), right_box, blur=10)

    left_mask_path = test_dir / "mask_left.png"
    right_mask_path = test_dir / "mask_right.png"
    preview_left_path = test_dir / "preview_left_mask.png"
    preview_right_path = test_dir / "preview_right_mask.png"

    left_mask.save(left_mask_path)
    right_mask.save(right_mask_path)

    overlay_mask(base, left_mask, (255, 0, 0, 255)).save(preview_left_path)
    overlay_mask(base, right_mask, (0, 80, 255, 255)).save(preview_right_path)

    print(f"LEFT_BOX={left_box}")
    print(f"RIGHT_BOX={right_box}")
    print(f"LEFT_MASK={left_mask_path}")
    print(f"RIGHT_MASK={right_mask_path}")
    print(f"PREVIEW_LEFT={preview_left_path}")
    print(f"PREVIEW_RIGHT={preview_right_path}")
    print("PHASE5B_MAKE_SLOT_MASKS_OK")


if __name__ == "__main__":
    main()
