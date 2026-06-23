# Kiwul Qwen 2509 Two Character Standard

## Provider Routing

Jika scene memiliki 2 character reference valid:

- Figure 1 = background_path dari background_prompt
- Figure 2 = character reference pertama
- Figure 3 = character reference kedua
- Provider = http://127.0.0.1:9500/v1/images/generations
- Model = kiwul-qwen2509-editplus
- Prompt = scene.image_prompt apa adanya
- Negative prompt = kosong

## Scene JSON Standard

Setiap scene 2 karakter wajib punya:

```json
{
  "scene_id": "scene_001",
  "scene_number": 1,
  "duration": 5,
  "vo": "Teks narasi voice over",
  "background_prompt": "Empty 2D animated interior background plate...",
  "image_prompt": "Create a natural final scene using Figure 1 as the background...",
  "video_prompt": "Animate both characters naturally...",
  "negative_prompt": ""
}
```

## Background Prompt Rule

background_prompt hanya untuk lokasi kosong.

Wajib:
- 2D animated background
- clean cartoon illustration
- environment only
- empty room / empty street / empty area
- no people
- no children
- no silhouettes
- no blurry person
- no background character

Jangan pakai kata:
- children storybook
- character style
- cute children
- people
- crowd
- person

Karena kata itu bisa membuat background menghasilkan orang kecil.

## Image Prompt Rule

image_prompt untuk Qwen harus lengkap dan memakai Figure 1 / Figure 2 / Figure 3.

Template dasar:

Create a natural final scene using Figure 1 as the background. Use Figures 2 and 3 only for character identity, face, hair, clothing, clothing color, body proportions, silhouette, and visual style. Do not copy the original poses, original hand positions, original props, original weapons, original objects, original pets, or original compositions of Figures 2 or 3. Change the pose of the character in Figure 2 to a new acting pose: [AKSI FIGURE 2]. Change the pose of the character in Figure 3 to a new acting pose: [AKSI FIGURE 3]. Blend both characters naturally into the lighting and perspective of Figure 1. The final result should be a single scene, not a reference sheet, not a character arrangement, not a poster.

## Known Issue

Kadang Qwen membuat ghost / shadow samar pada dinding kosong.

Solusi nanti:
- background jangan terlalu kosong pada dinding
- tambahkan dekorasi ringan seperti frame, rak, tirai, texture wall
- atau inpaint area ghost
- atau hapus ghost di tahap post-process
