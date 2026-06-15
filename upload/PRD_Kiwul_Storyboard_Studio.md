# PRD — Kiwul Storyboard Studio

**Versi:** 1.0  
**Status:** Draft lengkap  
**Produk:** Modul Storyboard mandiri dari Kiwul  
**Tujuan utama:** Load JSON storyboard → tampilkan VO, image prompt, video prompt → generate image/video → preview → download hasil.

---

## 1. Ringkasan Produk

**Kiwul Storyboard Studio** adalah program khusus untuk mengeksekusi storyboard berbasis JSON. Program ini tidak berfokus pada ideation atau pembuatan script dari nol, tetapi fokus pada tahap produksi visual: membaca storyboard dari JSON, menampilkan setiap scene, mengirim prompt image dan video ke provider lokal, lalu menyimpan serta menyediakan hasil image/video untuk di-preview dan di-download.

Setiap scene memiliki tiga komponen utama:

1. **VO** — narasi atau voice over.
2. **Image Prompt** — prompt untuk membuat gambar scene.
3. **Video Prompt** — prompt untuk membuat video dari gambar scene.

Program harus mendukung aspect ratio `9:16` dan `16:9`, durasi total dari `30 detik` sampai `15 menit`, jumlah scene mengikuti isi JSON, serta tombol **Generate All** dengan sistem queue dan polling sehingga hasil scene yang selesai langsung muncul tanpa menunggu seluruh proses selesai.

---

## 2. Tujuan Produk

Tujuan Kiwul Storyboard Studio:

1. Membaca storyboard dari file JSON.
2. Menampilkan scene dalam UI yang mudah dipahami.
3. Menyediakan editor VO, image prompt, dan video prompt per scene.
4. Menghubungkan program ke provider image dan video.
5. Generate image per scene.
6. Generate video per scene.
7. Generate semua scene melalui tombol **Generate All**.
8. Memakai sistem queue dan polling.
9. Menampilkan hasil image/video langsung saat selesai.
10. Menyediakan tombol download image dan video.
11. Menyediakan export JSON final berisi path hasil generate.
12. Tidak hardcoded pada provider, model, aspect ratio, durasi, atau jumlah scene.

---

## 3. Masalah yang Diselesaikan

Masalah utama dalam produksi video AI lokal:

1. Storyboard sering hanya berupa teks atau JSON yang belum bisa langsung dieksekusi.
2. VO, image prompt, dan video prompt sering tidak sinkron.
3. User harus copy-paste prompt satu per satu ke engine image/video.
4. Hasil image/video sulit dikaitkan kembali ke scene.
5. Tidak ada status per scene.
6. Jika satu scene gagal, user sulit regenerate hanya scene itu.
7. Tidak ada tombol download per scene.
8. Tidak ada sistem batch generation yang aman untuk GPU lokal.
9. Tidak ada polling progress sehingga user tidak tahu proses sedang berjalan atau macet.

Kiwul Storyboard Studio menyelesaikan masalah ini dengan satu workspace produksi storyboard yang terstruktur.

---

## 4. Target User

### 4.1 Primary User

Creator video AI lokal yang membuat:

- YouTube Shorts
- TikTok
- Instagram Reels
- video fakta sains
- video edukasi
- video dokumenter pendek
- micro drama
- konten faceless

### 4.2 Secondary User

Developer lokal yang membangun pipeline AI dengan:

- Ollama
- Z-Image
- F5-TTS
- WAN
- LTX
- ComfyUI
- FFmpeg
- Next.js
- SQLite / Prisma

---

## 5. Scope Produk

### 5.1 In Scope

Fitur yang masuk versi awal:

1. Load JSON storyboard.
2. Validasi JSON.
3. Tampilkan project info.
4. Tampilkan scene list.
5. Tampilkan detail scene.
6. Edit VO.
7. Edit image prompt.
8. Edit video prompt.
9. Edit negative prompt.
10. Pilih aspect ratio `9:16` atau `16:9`.
11. Validasi durasi total `30–900 detik`.
12. Generate image per scene.
13. Generate video per scene.
14. Generate all images.
15. Generate all videos.
16. Generate all image + video.
17. Sistem queue.
18. Sistem polling.
19. Preview image.
20. Preview video.
21. Download image per scene.
22. Download video per scene.
23. Download all images sebagai ZIP.
24. Download all videos sebagai ZIP.
25. Export JSON final.
26. Provider settings untuk image dan video.
27. Test connection provider.
28. Lock scene.
29. Retry failed scene.
30. Skip locked scene pada batch generate.

### 5.2 Out of Scope untuk MVP

Tidak wajib di versi awal:

1. Ide generation otomatis.
2. Script generation otomatis.
3. Storyline generator otomatis.
4. Character builder kompleks.
5. TTS generator.
6. Subtitle generator.
7. Final video composer.
8. Upload otomatis ke YouTube/TikTok.
9. Multi-user SaaS.
10. Payment system.
11. Cloud storage.

---

## 6. Konsep Utama

Program bekerja dengan konsep:

```text
JSON Storyboard
    ↓
Scene List
    ↓
VO + Image Prompt + Video Prompt
    ↓
Generate Image
    ↓
Generate Video
    ↓
Preview + Download
    ↓
Export JSON Final
```

---

## 7. Format JSON Input

Program harus menerima JSON dengan struktur minimal seperti ini:

```json
{
  "project": {
    "title": "Judul Video",
    "language": "id",
    "aspect_ratio": "9:16",
    "resolution": "1080x1920",
    "duration_seconds": 60,
    "style": "cinematic realistic",
    "target_platform": "youtube_shorts"
  },
  "scenes": [
    {
      "scene_id": "scene_001",
      "scene_number": 1,
      "duration": 3,
      "vo": "Bayangkan jika mimpi manusia bisa direkam.",
      "image_prompt": "cinematic realistic vertical frame, a person waking up in a dark bedroom, soft morning light, mysterious atmosphere",
      "video_prompt": "slow camera push in, subtle breathing motion, curtains moving gently, cinematic lighting",
      "negative_prompt": "blurry, low quality, distorted face, extra fingers",
      "locked": false,
      "image_status": "pending",
      "video_status": "pending",
      "image_path": null,
      "video_path": null
    }
  ]
}
```

---

## 8. Field JSON Wajib

Setiap scene wajib memiliki:

```json
{
  "scene_id": "string",
  "scene_number": "number",
  "duration": "number",
  "vo": "string",
  "image_prompt": "string",
  "video_prompt": "string"
}
```

---

## 9. Field JSON Opsional

Setiap scene boleh memiliki:

```json
{
  "negative_prompt": "string",
  "camera_prompt": "string",
  "motion_prompt": "string",
  "style_prompt": "string",
  "seed": "number",
  "locked": "boolean",
  "image_path": "string | null",
  "video_path": "string | null",
  "audio_path": "string | null",
  "image_status": "string",
  "video_status": "string",
  "error_message": "string | null"
}
```

---

## 10. Aspect Ratio dan Resolution

Program harus mendukung dua aspect ratio utama:

```text
9:16
16:9
```

### 10.1 Preset 9:16

Digunakan untuk:

- TikTok
- Reels
- YouTube Shorts

Preset resolution:

```text
480x832
720x1280
1080x1920
```

Default:

```text
1080x1920
```

Untuk engine lokal ringan, default teknis bisa:

```text
480x832
```

### 10.2 Preset 16:9

Digunakan untuk:

- YouTube long form
- video horizontal
- presentasi
- cinematic landscape

Preset resolution:

```text
832x480
1280x720
1920x1080
```

Default:

```text
1920x1080
```

Untuk engine lokal ringan, default teknis bisa:

```text
832x480
```

---

## 11. Durasi Project

Program harus mendukung durasi total:

```text
Minimum: 30 detik
Maximum: 15 menit
```

Dalam satuan detik:

```text
30 sampai 900 detik
```

Durasi total bisa berasal dari:

1. `project.duration_seconds`
2. hasil penjumlahan semua `scene.duration`

Jika keduanya ada, sistem membandingkan keduanya. Jika berbeda, tampilkan warning:

```text
Durasi project tidak sama dengan total durasi scene.
```

Jika durasi kurang dari 30 detik:

```text
Warning: durasi terlalu pendek. Minimum 30 detik.
```

Jika durasi lebih dari 900 detik:

```text
Warning: durasi terlalu panjang. Maximum 15 menit.
```

---

## 12. Jumlah Scene

Jumlah scene mengikuti isi JSON.

Tidak boleh ada batas hardcoded seperti 10, 20, atau 30 scene.

Aturan:

1. Minimal 1 scene.
2. Maksimal tidak dibatasi secara hardcoded.
3. UI harus tetap bisa scroll untuk scene banyak.
4. Scene bisa diurutkan berdasarkan `scene_number`.
5. Jika `scene_number` kosong, sistem bisa membuat nomor otomatis.
6. Jika ada `scene_id` duplikat, load JSON harus gagal atau memberi warning keras.

---

## 13. Status Scene

Status image dan video dipisah.

### 13.1 Image Status

```text
pending
queued
running
completed
failed
skipped
```

### 13.2 Video Status

```text
pending
queued
running
completed
failed
skipped
```

### 13.3 Scene Lock

Jika scene dikunci:

```json
{
  "locked": true
}
```

Maka scene tidak ikut batch regenerate.

---

## 14. UI Utama

UI terdiri dari empat area:

### 14.1 Top Toolbar

Berisi tombol:

```text
Load JSON
Save
Export JSON
Provider Settings
Generate All Images
Generate All Videos
Generate All
Generate Failed Only
Pause
Stop
Download Project ZIP
```

### 14.2 Sidebar Scene List

Menampilkan daftar scene:

```text
Scene 01 — image completed — video pending
Scene 02 — image running — video pending
Scene 03 — image failed — video skipped
```

### 14.3 Scene Detail Panel

Menampilkan dan mengedit:

- VO
- image prompt
- video prompt
- negative prompt
- duration
- seed
- locked
- status
- error message

### 14.4 Preview Panel

Menampilkan:

- image preview
- video preview
- download image
- download video
- regenerate image
- regenerate video

---

## 15. Scene Card Requirement

Setiap scene card minimal menampilkan:

```text
Scene 01
Duration: 3s
VO preview
Image Status: completed
Video Status: pending
[Generate Image]
[Generate Video]
[Download Image]
[Download Video]
[Lock]
```

Jika image belum ada, tombol Download Image disabled.

Jika video belum ada, tombol Download Video disabled.

---

## 16. Generate Image per Scene

Saat user klik **Generate Image**, sistem:

1. Mengecek scene tidak terkunci.
2. Membaca `image_prompt`.
3. Membaca `negative_prompt`.
4. Membaca aspect ratio dan resolution.
5. Mengirim request ke image provider.
6. Menyimpan hasil ke folder project.
7. Update `image_path`.
8. Update `image_status = completed`.
9. Menampilkan preview image.
10. Mengaktifkan tombol download image.

Output file:

```text
outputs/projects/{project_id}/images/{scene_id}.png
```

---

## 17. Generate Video per Scene

Saat user klik **Generate Video**, sistem:

1. Mengecek scene tidak terkunci.
2. Mengecek image sudah ada.
3. Membaca `image_path`.
4. Membaca `video_prompt`.
5. Membaca duration.
6. Membaca aspect ratio.
7. Mengirim request ke video provider.
8. Menyimpan hasil ke folder project.
9. Update `video_path`.
10. Update `video_status = completed`.
11. Menampilkan preview video.
12. Mengaktifkan tombol download video.

Output file:

```text
outputs/projects/{project_id}/videos/{scene_id}.mp4
```

---

## 18. Generate All

Program wajib memiliki tombol:

```text
Generate All Images
Generate All Videos
Generate All Image + Video
Generate Failed Only
```

### 18.1 Generate All Images

Generate image untuk semua scene yang:

```text
image_status != completed
locked = false
```

### 18.2 Generate All Videos

Generate video untuk semua scene yang:

```text
image_status = completed
video_status != completed
locked = false
```

### 18.3 Generate All Image + Video

Mode ini menjalankan pipeline lengkap:

```text
Scene 1 image → Scene 1 video
Scene 2 image → Scene 2 video
Scene 3 image → Scene 3 video
```

Untuk MVP, gunakan sequential agar aman untuk GPU lokal.

---

## 19. Queue System

Generate All harus memakai queue.

Saat user klik Generate All, backend membuat job:

```json
{
  "job_id": "job_001",
  "project_id": "project_001",
  "type": "generate_all",
  "status": "running",
  "total_tasks": 40,
  "completed_tasks": 0,
  "failed_tasks": 0
}
```

Setiap task:

```json
{
  "task_id": "task_001",
  "job_id": "job_001",
  "scene_id": "scene_001",
  "task_type": "image",
  "status": "queued"
}
```

Task status:

```text
queued
running
completed
failed
skipped
cancelled
```

---

## 20. Polling System

Frontend melakukan polling ke backend setiap 2–5 detik:

```http
GET /api/storyboard/jobs/{job_id}
```

Response:

```json
{
  "job_id": "job_001",
  "status": "running",
  "progress": {
    "total_tasks": 40,
    "completed_tasks": 13,
    "failed_tasks": 1,
    "queued_tasks": 26,
    "running_tasks": 1
  },
  "updated_scenes": [
    {
      "scene_id": "scene_003",
      "image_status": "completed",
      "video_status": "completed",
      "image_path": "/api/assets/projects/project_001/images/scene_003.png",
      "video_path": "/api/assets/projects/project_001/videos/scene_003.mp4"
    }
  ]
}
```

UI harus langsung update scene yang selesai tanpa menunggu semua task selesai.

---

## 21. Hasil Muncul Langsung

Jika satu scene selesai generate image:

1. Scene card langsung update.
2. Preview image muncul.
3. Download image aktif.

Jika satu scene selesai generate video:

1. Scene card langsung update.
2. Preview video muncul.
3. Download video aktif.

Program tidak boleh menunggu semua scene selesai baru menampilkan hasil.

---

## 22. Stop, Pause, Resume

### 22.1 Stop

Menghentikan job yang sedang berjalan.

```http
POST /api/storyboard/jobs/{job_id}/stop
```

### 22.2 Pause

Menunda task berikutnya, tetapi tidak membatalkan task yang sedang running.

```http
POST /api/storyboard/jobs/{job_id}/pause
```

### 22.3 Resume

Melanjutkan task yang masih queued.

```http
POST /api/storyboard/jobs/{job_id}/resume
```

---

## 23. Provider Settings

Program wajib memiliki halaman Provider Settings untuk:

1. Image Provider
2. Video Provider

Provider tidak boleh hardcoded. Semua disimpan ke database/config.

---

## 24. Image Provider

Default lokal:

```json
{
  "name": "Z-Image Local",
  "type": "image",
  "provider": "openai_image_compatible",
  "base_url": "http://127.0.0.1:9100",
  "endpoint": "/v1/images/generations",
  "model": "z-image-turbo",
  "api_key": "local",
  "timeout_seconds": 600,
  "is_default": true,
  "is_active": true
}
```

UI field:

```text
Provider Name
Base URL
Endpoint
Model
API Key
Timeout
Test Connection
Save
Set as Default
```

---

## 25. Video Provider

Default lokal:

```json
{
  "name": "WAN Local",
  "type": "video",
  "provider": "openai_video_compatible",
  "base_url": "http://127.0.0.1:9201",
  "endpoint": "/v1/videos/generations",
  "model": "wan-i2v",
  "api_key": "local",
  "timeout_seconds": 1800,
  "is_default": true,
  "is_active": true
}
```

Fallback lokal:

```json
{
  "name": "LTX Local",
  "type": "video",
  "provider": "openai_video_compatible",
  "base_url": "http://127.0.0.1:9200",
  "endpoint": "/v1/videos/generations",
  "model": "ltx-i2v",
  "api_key": "local",
  "timeout_seconds": 1800,
  "is_default": false,
  "is_active": true
}
```

---

## 26. Test Connection Provider

Provider settings harus punya tombol **Test Connection**.

### 26.1 Image Test

Coba endpoint:

```http
GET {base_url}/v1/models
```

Jika berhasil:

```json
{
  "ok": true,
  "message": "Image provider connected"
}
```

Jika gagal:

```json
{
  "ok": false,
  "message": "Connection failed"
}
```

### 26.2 Video Test

Coba endpoint:

```http
GET {base_url}/v1/models
```

Jika provider tidak punya `/v1/models`, coba:

```http
GET {base_url}/health
```

---

## 27. API Design

### 27.1 Load JSON

```http
POST /api/storyboard/load
```

Body:

```json
{
  "json": {}
}
```

Response:

```json
{
  "ok": true,
  "project_id": "project_001",
  "scenes": []
}
```

---

### 27.2 Get Project

```http
GET /api/storyboard/{project_id}
```

Response:

```json
{
  "project": {},
  "scenes": []
}
```

---

### 27.3 Update Scene

```http
PATCH /api/storyboard/{project_id}/scenes/{scene_id}
```

Body:

```json
{
  "vo": "...",
  "image_prompt": "...",
  "video_prompt": "...",
  "negative_prompt": "...",
  "locked": false
}
```

---

### 27.4 Generate Image

```http
POST /api/storyboard/{project_id}/scenes/{scene_id}/image
```

Response:

```json
{
  "ok": true,
  "image_path": "/api/assets/projects/project_001/images/scene_001.png"
}
```

---

### 27.5 Generate Video

```http
POST /api/storyboard/{project_id}/scenes/{scene_id}/video
```

Response:

```json
{
  "ok": true,
  "video_path": "/api/assets/projects/project_001/videos/scene_001.mp4"
}
```

---

### 27.6 Generate All

```http
POST /api/storyboard/{project_id}/generate-all
```

Body:

```json
{
  "mode": "image_and_video",
  "skip_locked": true,
  "failed_only": false,
  "concurrency": {
    "image": 1,
    "video": 1
  }
}
```

Response:

```json
{
  "ok": true,
  "job_id": "job_001"
}
```

---

### 27.7 Poll Job

```http
GET /api/storyboard/jobs/{job_id}
```

---

### 27.8 Stop Job

```http
POST /api/storyboard/jobs/{job_id}/stop
```

---

### 27.9 Export JSON

```http
GET /api/storyboard/{project_id}/export
```

---

### 27.10 Download Image

```http
GET /api/storyboard/{project_id}/scenes/{scene_id}/download/image
```

---

### 27.11 Download Video

```http
GET /api/storyboard/{project_id}/scenes/{scene_id}/download/video
```

---

### 27.12 Download ZIP

```http
GET /api/storyboard/{project_id}/download/images.zip
GET /api/storyboard/{project_id}/download/videos.zip
GET /api/storyboard/{project_id}/download/project.zip
```

---

## 28. Folder Output

Struktur folder:

```text
outputs/
  storyboard/
    {project_id}/
      storyboard_original.json
      storyboard_final.json
      images/
        scene_001.png
        scene_002.png
      videos/
        scene_001.mp4
        scene_002.mp4
      exports/
        images.zip
        videos.zip
        project.zip
```

---

## 29. Download Requirement

Setiap scene wajib memiliki tombol:

```text
Download Image
Download Video
```

Batch download:

```text
Download All Images ZIP
Download All Videos ZIP
Download Project ZIP
```

Nama file download:

```text
scene_001_image.png
scene_001_video.mp4
```

ZIP project berisi:

```text
project_title/
  storyboard_original.json
  storyboard_final.json
  images/
    scene_001.png
  videos/
    scene_001.mp4
```

---

## 30. Export JSON Final

JSON final harus berisi semua data project, provider, prompt, status, dan output path.

```json
{
  "project": {
    "title": "Judul Video",
    "language": "id",
    "aspect_ratio": "9:16",
    "resolution": "1080x1920",
    "duration_seconds": 180,
    "providers": {
      "image": {
        "name": "Z-Image Local",
        "base_url": "http://127.0.0.1:9100",
        "model": "z-image-turbo"
      },
      "video": {
        "name": "WAN Local",
        "base_url": "http://127.0.0.1:9201",
        "model": "wan-i2v"
      }
    }
  },
  "scenes": [
    {
      "scene_id": "scene_001",
      "scene_number": 1,
      "duration": 3,
      "vo": "Bayangkan jika mimpi manusia bisa direkam.",
      "image_prompt": "...",
      "video_prompt": "...",
      "negative_prompt": "...",
      "image_status": "completed",
      "video_status": "completed",
      "image_path": "/api/assets/storyboard/project_001/images/scene_001.png",
      "video_path": "/api/assets/storyboard/project_001/videos/scene_001.mp4",
      "locked": false
    }
  ]
}
```

---

## 31. Database Schema Prisma

```prisma
model StoryboardProject {
  id               String   @id @default(cuid())
  title            String
  language         String   @default("id")
  aspect_ratio     String   @default("9:16")
  resolution       String   @default("1080x1920")
  duration_seconds Int?
  style            String?
  status           String   @default("draft")
  json_path        String?
  final_json_path  String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  scenes           StoryboardScene[]
  jobs             StoryboardJob[]
}

model StoryboardScene {
  id              String   @id @default(cuid())
  project_id      String
  scene_id        String
  scene_number    Int
  duration        Int
  vo              String
  image_prompt    String
  video_prompt    String
  negative_prompt String?
  image_path      String?
  video_path      String?
  image_status    String   @default("pending")
  video_status    String   @default("pending")
  locked          Boolean  @default(false)
  error_message   String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  project StoryboardProject @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([project_id, scene_id])
}

model StoryboardProvider {
  id              String   @id @default(cuid())
  type            String
  name            String
  provider        String
  base_url        String
  endpoint        String?
  model           String
  api_key         String?
  config_json     String   @default("{}")
  is_default      Boolean  @default(false)
  is_active       Boolean  @default(true)
  timeout_seconds Int      @default(600)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

model StoryboardJob {
  id              String   @id @default(cuid())
  project_id      String
  type            String
  status          String   @default("queued")
  total_tasks     Int      @default(0)
  completed_tasks Int      @default(0)
  failed_tasks    Int      @default(0)
  config_json     String   @default("{}")
  error_message   String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  project         StoryboardProject @relation(fields: [project_id], references: [id], onDelete: Cascade)
  tasks           StoryboardTask[]
}

model StoryboardTask {
  id            String   @id @default(cuid())
  job_id        String
  scene_id      String
  task_type     String
  status        String   @default("queued")
  output_path   String?
  error_message String?
  started_at    DateTime?
  completed_at  DateTime?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  job StoryboardJob @relation(fields: [job_id], references: [id], onDelete: Cascade)
}
```

---

## 32. Validasi JSON

Saat load JSON, sistem wajib mengecek:

1. JSON valid.
2. `project` ada.
3. `scenes` ada dan berupa array.
4. Minimal 1 scene.
5. Setiap scene punya `scene_id`.
6. Setiap scene punya `vo`.
7. Setiap scene punya `image_prompt`.
8. Setiap scene punya `video_prompt`.
9. Setiap scene punya `duration`.
10. Tidak ada `scene_id` duplikat.
11. `aspect_ratio` hanya `9:16` atau `16:9`.
12. Total durasi antara `30` dan `900` detik.
13. Jika `duration_seconds` tidak cocok dengan total scene, tampilkan warning.

---

## 33. Error Handling

Jika image gagal:

```json
{
  "image_status": "failed",
  "error_message": "Image provider timeout"
}
```

Jika video gagal:

```json
{
  "video_status": "failed",
  "error_message": "Video provider timeout"
}
```

UI wajib menyediakan:

```text
Retry
Copy Error
Reset Status
Skip Scene
```

---

## 34. UX Requirement

Prinsip UX:

1. Sederhana.
2. Semua scene terlihat jelas.
3. Status image/video mudah dibaca.
4. Prompt bisa diedit langsung.
5. Tombol generate dekat dengan prompt.
6. Preview langsung muncul.
7. Download satu klik.
8. Scene gagal mudah ditemukan.
9. Batch generate aman untuk GPU lokal.
10. Tidak ada setting penting yang hardcoded.

---

## 35. MVP Requirement

MVP wajib selesai jika memiliki:

1. Load JSON.
2. Validasi JSON.
3. Pilih aspect ratio.
4. Validasi durasi 30–900 detik.
5. Scene list fleksibel.
6. Edit VO.
7. Edit image prompt.
8. Edit video prompt.
9. Provider settings image.
10. Provider settings video.
11. Test connection provider.
12. Generate image per scene.
13. Generate video per scene.
14. Generate All.
15. Queue system.
16. Polling progress.
17. Preview image.
18. Preview video.
19. Download image.
20. Download video.
21. Download ZIP.
22. Export JSON final.

---

## 36. Future Improvement

Fitur lanjutan:

1. Drag and drop reorder scene.
2. Timeline preview.
3. Prompt enhancer.
4. Seed control.
5. Compare hasil regenerate.
6. Character reference injection.
7. TTS generation.
8. Subtitle generation.
9. Final video composer.
10. Upload otomatis ke YouTube.
11. Preset style.
12. Multi-provider fallback.
13. Auto retry.
14. Scene dependency.
15. Render final video.

---

## 37. Acceptance Criteria

Produk dianggap selesai jika:

1. User bisa load JSON storyboard.
2. User bisa melihat semua scene.
3. User bisa memilih `9:16` atau `16:9`.
4. User bisa memakai durasi 30 detik sampai 15 menit.
5. Jumlah scene mengikuti JSON.
6. User bisa konek image provider dari UI.
7. User bisa konek video provider dari UI.
8. User bisa test provider.
9. User bisa generate image per scene.
10. User bisa generate video per scene.
11. User bisa klik Generate All.
12. Backend membuat job queue.
13. Frontend polling job status.
14. Scene yang selesai langsung muncul hasilnya.
15. User bisa download image.
16. User bisa download video.
17. User bisa download ZIP.
18. User bisa export JSON final.
19. Scene locked tidak ikut batch generate.
20. Scene failed bisa retry.
21. Provider bisa diganti tanpa ubah kode.

---

## 38. Kesimpulan

Kiwul Storyboard Studio adalah modul khusus untuk mengeksekusi storyboard dari JSON menjadi aset image dan video. Modul ini harus ringan, lokal, fleksibel, dan siap terhubung ke provider image/video seperti Z-Image, WAN, LTX, atau provider OpenAI-compatible lain.

Fokus utama produk ini adalah:

```text
Load JSON → Scene Editor → Provider Connection → Generate All → Polling → Preview → Download → Export JSON Final
```

Produk ini menjadi fondasi penting untuk pipeline produksi video AI lokal karena memisahkan tahap storyboard dari tahap ideation, scriptwriting, TTS, subtitle, dan final render.
