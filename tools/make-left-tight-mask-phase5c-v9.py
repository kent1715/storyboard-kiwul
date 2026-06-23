from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


def overlay_mask(base, mask, color=(255, 0, 0, 255), opacity=0.38):
    base = base.convert("RGBA")
    overlay = Image.new("RGBA", base.size, color)
    alpha = mask.point(lambda p: int(p * opacity))
    overlay.putalpha(alpha)
    return Image.alpha_composite(base, overlay)


def main():
    project_id = "cmqj0naeg0000vab0fa5wos9z"
    test_dir = Path("D:/storyboard-kiwul/outputs/storyboard") / project_id / "inpaint_tests"

    base_path = test_dir / "uno_base.png"
    if not base_path.exists():
        raise RuntimeError(f"BASE_NOT_FOUND={base_path}")

    base = Image.open(base_path).convert("RGBA")
    w, h = base.size

    print("PHASE5C_TIGHT_MASK_V9_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    # Upper/main structure: tetap mirip V8 karena kiri-kanan sudah pas
    draw.polygon(
        [
            (int(w * 0.00), int(h * 0.10)),
            (int(w * 0.31), int(h * 0.05)),
            (int(w * 0.47), int(h * 0.22)),
            (int(w * 0.47), int(h * 0.98)),
            (int(w * 0.00), int(h * 0.98)),
        ],
        fill=255,
    )

    # rambut + kepala atas
    draw.ellipse(
        [
            int(w * -0.03),
            int(h * -0.01),
            int(w * 0.40),
            int(h * 0.38),
        ],
        fill=255,
    )

    # wajah / pipi / dagu kanan
    draw.ellipse(
        [
            int(w * 0.14),
            int(h * 0.10),
            int(w * 0.47),
            int(h * 0.50),
        ],
        fill=255,
    )

    # leher + bahu
    draw.ellipse(
        [
            int(w * 0.00),
            int(h * 0.28),
            int(w * 0.49),
            int(h * 0.74),
        ],
        fill=255,
    )

    # torso utama
    draw.rectangle(
        [
            int(w * 0.00),
            int(h * 0.50),
            int(w * 0.47),
            int(h * 0.98),
        ],
        fill=255,
    )

    # V9 improvement:
    # tambah coverage bawah tanpa banyak mengubah sisi kanan
    draw.ellipse(
        [
            int(w * 0.02),
            int(h * 0.52),
            int(w * 0.46),
            int(h * 1.02),
        ],
        fill=255,
    )

    # tambahan area bawah-tengah agar dada/torso bawah lebih tertutup
    draw.rectangle(
        [
            int(w * 0.00),
            int(h * 0.66),
            int(w * 0.45),
            int(h * 1.00),
        ],
        fill=255,
    )

    mask = mask.filter(ImageFilter.GaussianBlur(8))

    mask_path = test_dir / "mask_left_tight_v9.png"
    preview_path = test_dir / "preview_left_tight_v9.png"

    mask.save(mask_path)
    overlay_mask(base, mask).save(preview_path)

    print(f"MASK={mask_path}")
    print(f"PREVIEW={preview_path}")
    print("PHASE5C_TIGHT_MASK_V9_OK")


if __name__ == "__main__":
    main()
