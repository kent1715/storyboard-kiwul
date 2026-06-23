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

    print("PHASE5C_TIGHT_MASK_V5_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    # V5:
    # - lebih geser kiri
    # - sisi kanan dipersempit agar tidak kena char_B
    # - tetap cukup untuk kepala + torso char_A

    body_poly = [
        (int(w * 0.00), int(h * 0.16)),
        (int(w * 0.24), int(h * 0.10)),
        (int(w * 0.34), int(h * 0.22)),
        (int(w * 0.33), int(h * 0.96)),
        (int(w * 0.00), int(h * 0.96)),
    ]
    draw.polygon(body_poly, fill=255)

    # Area kepala/rambut kiri, juga dipersempit
    draw.ellipse(
        [
            int(w * -0.02),
            int(h * 0.02),
            int(w * 0.28),
            int(h * 0.35),
        ],
        fill=255,
    )

    # Tambahan kecil untuk leher/bahu agar transisi lebih natural
    draw.ellipse(
        [
            int(w * 0.05),
            int(h * 0.25),
            int(w * 0.30),
            int(h * 0.58),
        ],
        fill=255,
    )

    # Blur sedikit agar tepi tidak keras
    mask = mask.filter(ImageFilter.GaussianBlur(8))

    mask_path = test_dir / "mask_left_tight_v5.png"
    preview_path = test_dir / "preview_left_tight_v5.png"

    mask.save(mask_path)
    overlay_mask(base, mask).save(preview_path)

    print(f"MASK={mask_path}")
    print(f"PREVIEW={preview_path}")
    print("PHASE5C_TIGHT_MASK_V5_OK")


if __name__ == "__main__":
    main()
