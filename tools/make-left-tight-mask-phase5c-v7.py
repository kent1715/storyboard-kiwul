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

    print("PHASE5C_TIGHT_MASK_V7_START")
    print(f"BASE={base_path}")
    print(f"SIZE={w}x{h}")

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)

    # V7:
    # - lebih lebar dari V6
    # - menutup wajah kanan, dagu, leher, bahu, dan torso char_A
    # - batas kanan masih sebelum char_B

    # badan utama
    draw.polygon(
        [
            (int(w * 0.00), int(h * 0.12)),
            (int(w * 0.30), int(h * 0.06)),
            (int(w * 0.44), int(h * 0.22)),
            (int(w * 0.43), int(h * 0.98)),
            (int(w * 0.00), int(h * 0.98)),
        ],
        fill=255,
    )

    # kepala dan rambut
    draw.ellipse(
        [
            int(w * -0.02),
            int(h * 0.00),
            int(w * 0.39),
            int(h * 0.39),
        ],
        fill=255,
    )

    # wajah kanan / pipi / dagu
    draw.ellipse(
        [
            int(w * 0.15),
            int(h * 0.10),
            int(w * 0.45),
            int(h * 0.49),
        ],
        fill=255,
    )

    # leher dan bahu
    draw.ellipse(
        [
            int(w * 0.02),
            int(h * 0.28),
            int(w * 0.44),
            int(h * 0.72),
        ],
        fill=255,
    )

    # torso bawah
    draw.rectangle(
        [
            int(w * 0.00),
            int(h * 0.52),
            int(w * 0.43),
            int(h * 0.98),
        ],
        fill=255,
    )

    # Blur tepi
    mask = mask.filter(ImageFilter.GaussianBlur(8))

    mask_path = test_dir / "mask_left_tight_v7.png"
    preview_path = test_dir / "preview_left_tight_v7.png"

    mask.save(mask_path)
    overlay_mask(base, mask).save(preview_path)

    print(f"MASK={mask_path}")
    print(f"PREVIEW={preview_path}")
    print("PHASE5C_TIGHT_MASK_V7_OK")


if __name__ == "__main__":
    main()
