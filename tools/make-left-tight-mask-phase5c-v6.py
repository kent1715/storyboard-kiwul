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

    print("PHASE5C_TIGHT_MASK_V6_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    # V6:
    # - sedikit lebih lebar dari V5
    # - kanan hanya sampai sekitar 38% width agar tetap aman dari char_B
    # - cukup menutup kepala, rambut, leher, bahu, torso char_A

    body_poly = [
        (int(w * 0.00), int(h * 0.15)),
        (int(w * 0.28), int(h * 0.08)),
        (int(w * 0.39), int(h * 0.22)),
        (int(w * 0.38), int(h * 0.96)),
        (int(w * 0.00), int(h * 0.96)),
    ]
    draw.polygon(body_poly, fill=255)

    # Kepala/rambut, dilebarkan sedikit dibanding V5
    draw.ellipse(
        [
            int(w * -0.02),
            int(h * 0.02),
            int(w * 0.34),
            int(h * 0.37),
        ],
        fill=255,
    )

    # Area wajah kanan / pipi / dagu agar tidak terpotong
    draw.ellipse(
        [
            int(w * 0.14),
            int(h * 0.12),
            int(w * 0.39),
            int(h * 0.46),
        ],
        fill=255,
    )

    # Leher dan bahu
    draw.ellipse(
        [
            int(w * 0.02),
            int(h * 0.28),
            int(w * 0.38),
            int(h * 0.70),
        ],
        fill=255,
    )

    # Dada bawah kiri
    draw.rectangle(
        [
            int(w * 0.00),
            int(h * 0.52),
            int(w * 0.36),
            int(h * 0.98),
        ],
        fill=255,
    )

    mask = mask.filter(ImageFilter.GaussianBlur(8))

    mask_path = test_dir / "mask_left_tight_v6.png"
    preview_path = test_dir / "preview_left_tight_v6.png"

    mask.save(mask_path)
    overlay_mask(base, mask).save(preview_path)

    print(f"MASK={mask_path}")
    print(f"PREVIEW={preview_path}")
    print("PHASE5C_TIGHT_MASK_V6_OK")


if __name__ == "__main__":
    main()
