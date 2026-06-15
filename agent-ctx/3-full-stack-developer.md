---
Task ID: 3
Agent: full-stack-developer
Task: Build all backend API routes for Kiwul Storyboard Studio

Work Log:
- Installed archiver and @types/archiver packages for ZIP support
- Created 16 new API route files in src/app/api/storyboard/:
  1. [projectId]/route.ts - GET project with scenes
  2. [projectId]/scenes/[sceneId]/route.ts - PATCH update scene fields
  3. [projectId]/scenes/[sceneId]/image/route.ts - POST generate image using z-ai-web-dev-sdk ImageGen
  4. [projectId]/scenes/[sceneId]/video/route.ts - POST generate video using provider API directly
  5. [projectId]/generate-all/route.ts - POST create batch generation job with storyboardQueue
  6. [projectId]/export/route.ts - GET export final JSON with saveFinalJSON
  7. jobs/[jobId]/route.ts - GET job progress with task counts and scene statuses
  8. jobs/[jobId]/stop/route.ts - POST stop job via storyboardQueue
  9. jobs/[jobId]/pause/route.ts - POST pause job via storyboardQueue
  10. jobs/[jobId]/resume/route.ts - POST resume job via storyboardQueue
  11. [projectId]/scenes/[sceneId]/download/image/route.ts - GET serve image file
  12. [projectId]/scenes/[sceneId]/download/video/route.ts - GET serve video file
  13. [projectId]/download/route.ts - GET ZIP download (images/videos/project)
  14. providers/route.ts - GET list providers, POST create provider
  15. providers/[providerId]/route.ts - PATCH update provider, DELETE provider
  16. providers/test/route.ts - POST test provider connection

Key Decisions:
- Image generation uses z-ai-web-dev-sdk ImageGen class as required
- Video generation uses direct fetch to provider API with OpenAI-compatible format
- Download routes use Node.js fs to read files and return with proper Content-Type headers
- ZIP creation uses archiver library with streaming approach
- Provider test route tries /v1/models first, then falls back to /health
- All routes use Next.js 16 App Router with async params pattern
- Scene update route only allows whitelisted fields for security
- Generate-all creates StoryboardJob and StoryboardTask records then enqueues via storyboardQueue
- Export route builds full JSON structure with export_info metadata and saves via saveFinalJSON

Stage Summary:
- All 18 API endpoints (16 new + 1 existing load + 1 root) are created and working
- Lint passes with 0 errors (only pre-existing warnings in UI components)
- Dev server running without issues
