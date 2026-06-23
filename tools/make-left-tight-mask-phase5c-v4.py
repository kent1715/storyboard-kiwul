import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


def overlay_mask(base, mask, color):
    base = base.convert("RGBA")
    overlay = Image.new("RGBA", base.size, color)
    alpha = mask.point(lambda p: int(p * 0.45))
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

    print("PHASE5C_TIGHT_MASK_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    # Mask lebih ketat untuk karakter kiri:
    # tidak menutup background kosong besar di tengah.
    # Bentuk dibuat polygon + ellipse agar tidak kotak keras.
    body_poly = [
        (int(w * 0.02), int(h * 0.14)),
        (int(w * 0.31), int(h * 0.08)),
        (int(w * 0.43), int(h * 0.28)),
        (int(w * 0.39), int(h * 0.96)),
        (int(w * 0.03), int(h * 0.96)),
    ]

    draw.polygon(body_poly, fill=255)

    # Tambahan area kepala/rambut kiri.
    draw.ellipse(
        [
            int(w * 0.03),
            int(h * 0.04),
            int(w * 0.35),
            int(h * 0.36),
        ],
        fill=255,
    )

    # Sedikit blur agar pinggir mask lebih nyatu.
    mask = mask.filter(ImageFilter.GaussianBlur(8))

    mask_path = test_dir / "mask_left_tight_v4.png"
    preview_path = test_dir / "preview_left_tight_v4.png"

    mask.save(mask_path)
    overlay_mask(base, mask, (255, 0, 0, 255)).save(preview_path)

    print(f"MASK={mask_path}")
    print(f"PREVIEW={preview_path}")
    print("PHASE5C_TIGHT_MASK_OK")


if __name__ == "__main__":
    main()
