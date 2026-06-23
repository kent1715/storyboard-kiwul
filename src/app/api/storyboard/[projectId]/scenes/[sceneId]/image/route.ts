import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { saveImageFile, ensureProjectDirs } from '@/lib/file-storage';
import { appendReferenceContextToPrompt } from '@/lib/reference-context';
import { buildReferenceImagePayload, buildCharacterReferenceFields } from '@/lib/reference-payload';
import { Agent, fetch as undiciFetch } from 'undici'


function joinProviderUrl(baseUrl: string, endpoint: string | null | undefined): string {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const ep = String(endpoint || '/v1/images/generations')
  return `${base}${ep.startsWith('/') ? ep : `/${ep}`}`
}

function authHeaders(apiKey: string | null | undefined): Record<string, string> {
  const key = String(apiKey || '').trim()
  if (!key || key === 'local' || key === 'none') return {}
  return { Authorization: `Bearer ${key}` }
}

async function imageUrlToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1] || ''
    return Buffer.from(base64, 'base64')
  }

  if (/^[A-Za-z]:\\/.test(url)) {
    const fs = await import('fs/promises')
    return fs.readFile(url)
  }

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download generated image: HTTP ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function extractImageFromProviderResponse(data: any): string {
  const first = data?.data?.[0] || data?.images?.[0] || data

  const value =
    first?.b64_json ||
    first?.url ||
    first?.image ||
    first?.image_url ||
    first?.file_path ||
    first?.path ||
    data?.image_path ||
    data?.url

  if (!value || typeof value !== 'string') {
    throw new Error('Image provider response did not contain image url/path/base64')
  }

  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`
  return value
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    // Regenerate Image: remove old image files and reset DB state before starting a new generation
    try {
      const imagesDir = path.join(
        process.cwd(),
        'outputs',
        'storyboard',
        projectId,
        'images'
      );

      const files = await fs.readdir(imagesDir).catch(() => []);

      for (const file of files) {
        if (
          file.toLowerCase().endsWith('.png') &&
          (file === `${sceneId}.png` || file.startsWith(`${sceneId}_`))
        ) {
          await fs.unlink(path.join(imagesDir, file)).catch(() => null);
        }
      }

      await db.storyboardScene.updateMany({
        where: {
          project_id: projectId,
          scene_id: sceneId,
        },
        data: {
          image_status: 'pending',
          image_path: null,
          error_message: null,
        },
      });
    } catch (resetError) {
      console.warn('[regenerate image reset warning]', resetError);
    }


    // Find the scene
    const scene = await db.storyboardScene.findFirst({
      where: { project_id: projectId, scene_id: sceneId },
    });

    if (!scene) {
      return NextResponse.json(
        { ok: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Check if scene is locked
    if (scene.locked) {
      return NextResponse.json(
        { ok: false, error: 'Scene is locked' },
        { status: 403 }
      );
    }

    // Get default image provider
    const provider = await db.storyboardProvider.findFirst({
      where: { type: 'image', is_default: true, is_active: true },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'No active default image provider found' },
        { status: 400 }
      );
    }

    // Update scene status to running
    await db.storyboardScene.update({
      where: { id: scene.id },
      data: { image_status: 'running' },
    });

    try {
      const rawSceneImagePrompt = String(scene.image_prompt || '');
      const cleanFullCharacterPrompt = rawSceneImagePrompt.trim();
      const looksLikeMultiCharacterScene =
        /character\s*2/i.test(rawSceneImagePrompt) ||
        /two\s+different/i.test(rawSceneImagePrompt) ||
        /two\s+people/i.test(rawSceneImagePrompt) ||
        /two\s+characters/i.test(rawSceneImagePrompt) ||
        /two\s+young/i.test(rawSceneImagePrompt) ||
        /two\s+men/i.test(rawSceneImagePrompt) ||
        /two\s+women/i.test(rawSceneImagePrompt) ||
        /both\s+people/i.test(rawSceneImagePrompt) ||
        /both\s+men/i.test(rawSceneImagePrompt) ||
        /both\s+women/i.test(rawSceneImagePrompt) ||
        /standing\s+side\s+by\s+side/i.test(rawSceneImagePrompt) ||
        /his\s+friend/i.test(rawSceneImagePrompt) ||
        /her\s+friend/i.test(rawSceneImagePrompt) ||
        /friend\s+behind/i.test(rawSceneImagePrompt) ||
        /sitting\s+across\s+from\s+each\s+other/i.test(rawSceneImagePrompt) ||
        /Doni\s+.*Fajar/i.test(rawSceneImagePrompt) ||
        /Fajar\s+.*Doni/i.test(rawSceneImagePrompt);

      const looksLikeSingleCharacterScene =
        /one\s+young/i.test(rawSceneImagePrompt) ||
        /single\s+young/i.test(rawSceneImagePrompt) ||
        /young\s+Indonesian\s+man/i.test(rawSceneImagePrompt) ||
        /young\s+Indonesian\s+woman/i.test(rawSceneImagePrompt) ||
        /Indonesian\s+man/i.test(rawSceneImagePrompt) ||
        /Indonesian\s+woman/i.test(rawSceneImagePrompt) ||
        /man\s+standing/i.test(rawSceneImagePrompt) ||
        /woman\s+standing/i.test(rawSceneImagePrompt) ||
        /man\s+sitting/i.test(rawSceneImagePrompt) ||
        /woman\s+sitting/i.test(rawSceneImagePrompt) ||
        /man\s+holding/i.test(rawSceneImagePrompt) ||
        /woman\s+holding/i.test(rawSceneImagePrompt) ||
        /face\s+lit/i.test(rawSceneImagePrompt) ||
        /wide\s+terrified\s+eyes/i.test(rawSceneImagePrompt);

      const referenceImages = await buildReferenceImagePayload(projectId, sceneId);
      const characterReferenceFields = buildCharacterReferenceFields(referenceImages);
      const characterReferences = referenceImages.filter((item) => item.kind === 'character');
      const useFullCharacterProvider =
        characterReferences.length === 1 &&
        looksLikeSingleCharacterScene &&
        !looksLikeMultiCharacterScene;

      const useTwoCharacterProvider =
        characterReferences.length >= 2;

      const finalImagePrompt =
        useTwoCharacterProvider
          ? cleanFullCharacterPrompt
          : useFullCharacterProvider
            ? cleanFullCharacterPrompt
            : await appendReferenceContextToPrompt(projectId, scene.image_prompt || '');

      const selectedImageProvider = useTwoCharacterProvider
        ? {
            base_url: 'http://127.0.0.1:9500',
            endpoint: '/v1/images/generations',
            model: 'kiwul-qwen2509-editplus',
            api_key: 'local',
            timeout_seconds: Math.max(1200, provider.timeout_seconds || 1200),
          }
        : useFullCharacterProvider
          ? {
              base_url: 'http://127.0.0.1:9410',
              endpoint: '/v1/images/generations',
              model: 'comfyui-full-character-sdxl',
              api_key: 'local',
              timeout_seconds: Math.max(1200, provider.timeout_seconds || 1200),
            }
          : provider;

      const url = joinProviderUrl(selectedImageProvider.base_url, selectedImageProvider.endpoint)

      console.log('[image provider routing]', {
        projectId,
        sceneId,
        characterReferenceCount: characterReferences.length,
        looksLikeSingleCharacterScene,
        looksLikeMultiCharacterScene,
        useFullCharacterProvider,
        useTwoCharacterProvider,
        url,
        model: selectedImageProvider.model,
      })

      const projectRow = await (db as any).storyboardProject.findUnique({
        where: { id: projectId },
      }).catch(() => null as any)

      const projectAspectRatio =
        projectRow?.aspect_ratio ||
        projectRow?.aspectRatio ||
        projectRow?.aspect_ratio_value ||
        projectRow?.format ||
        projectRow?.resolution ||
        projectRow?.video_aspect_ratio ||
        '9:16'

      const isLandscape = String(projectAspectRatio).includes('16:9')

      const imageWidth = isLandscape ? 1024 : 576
      const imageHeight = isLandscape ? 576 : 1024
      const imageSize = `${imageWidth}x${imageHeight}`
      const imageAspectRatio = isLandscape ? '16:9' : '9:16'

      console.log('[image aspect]', {
        projectId,
        projectAspectRatio,
        imageWidth,
        imageHeight,
        imageSize,
        imageAspectRatio,
      })

      const timeoutMs = Math.max(60, selectedImageProvider.timeout_seconds || 1200) * 1000
      const imageProviderDispatcher = new Agent({
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      })

      let qwen2509BaseImageValue: string | null = null

      if (useTwoCharacterProvider) {
        const backgroundPath = (scene as any).background_path || null
        const backgroundStatus = (scene as any).background_status || null

        if (!backgroundPath || backgroundStatus !== 'completed') {
          throw new Error('Background belum dibuat atau belum completed. Generate background dulu sebelum generate image dua karakter.')
        }

        if (String(backgroundPath).startsWith('data:image/')) {
          qwen2509BaseImageValue = String(backgroundPath)
        } else if (String(backgroundPath).startsWith('/api/')) {
          const backgroundUrl = new URL(String(backgroundPath), request.nextUrl.origin)
          const backgroundResponse = await fetch(backgroundUrl)

          if (!backgroundResponse.ok) {
            throw new Error(`Failed to fetch background_path ${backgroundUrl.toString()} HTTP ${backgroundResponse.status}`)
          }

          const backgroundBuffer = Buffer.from(await backgroundResponse.arrayBuffer())
          qwen2509BaseImageValue = `data:image/png;base64,${backgroundBuffer.toString('base64')}`
        } else {
          const fsPromises = await import('fs/promises')
          const fsSync = await import('fs')
          const pathMod = await import('path')
          let resolvedBackgroundPath = String(backgroundPath)

          if (!fsSync.existsSync(resolvedBackgroundPath)) {
            const imagesDir = pathMod.join(process.cwd(), 'outputs', 'storyboard', projectId, 'images')
            const latestBackground = fsSync.existsSync(imagesDir)
              ? fsSync.readdirSync(imagesDir)
                  .filter((name) => name.startsWith(`${sceneId}_background_`) && name.endsWith('.png'))
                  .map((name) => {
                    const fullPath = pathMod.join(imagesDir, name)
                    const stat = fsSync.statSync(fullPath)
                    return { name, fullPath, mtimeMs: stat.mtimeMs }
                  })
                  .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
              : null

            if (!latestBackground) {
              throw new Error(`Background file not found and no fallback background exists. Missing: ${resolvedBackgroundPath}`)
            }

            resolvedBackgroundPath = latestBackground.fullPath

            await db.storyboardScene.update({
              where: { id: scene.id },
              data: {
                background_path: resolvedBackgroundPath,
                background_status: 'completed',
                background_error_message: null,
              },
            })

            console.log('[qwen2509 background fallback latest file]', {
              projectId,
              sceneId,
              oldBackgroundPath: backgroundPath,
              resolvedBackgroundPath,
            })
          }

          const backgroundBuffer = await fsPromises.readFile(resolvedBackgroundPath)
          qwen2509BaseImageValue = `data:image/png;base64,${backgroundBuffer.toString('base64')}`
        }
        console.log('[qwen2509 base from background_path]', {
          projectId,
          sceneId,
          backgroundStatus,
          backgroundPathPrefix: String(backgroundPath).slice(0, 30),
          backgroundPathLength: String(backgroundPath).length,
          qwen2509BaseImageValueLength: qwen2509BaseImageValue?.length || 0,
        })
      }

      const response = await undiciFetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        dispatcher: imageProviderDispatcher as any,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(selectedImageProvider.api_key),
        },
        body: JSON.stringify(
          useTwoCharacterProvider
            ? {
                model: selectedImageProvider.model || 'kiwul-qwen2509-editplus',
                prompt: finalImagePrompt,
                negative_prompt: '',
                reference_images: [
                  {
                    type: 'base',
                    image: qwen2509BaseImageValue,
                  },
                  {
                    type: 'character',
                    name: 'char_A',
                    image: characterReferences[0]?.file_path,
                  },
                  {
                    type: 'character',
                    name: 'char_B',
                    image: characterReferences[1]?.file_path,
                  },
                ],
                size: imageSize,
                n: 1,
              }
            : useFullCharacterProvider
              ? {
                  model: selectedImageProvider.model || 'comfyui-full-character-sdxl',
                  prompt: finalImagePrompt,
                  negative_prompt: scene.negative_prompt || undefined,
                  reference_image: characterReferences[0]?.file_path,
                  size: imageSize,
                  n: 1,
                }
              : {
                model: selectedImageProvider.model || 'z-image-turbo',
                prompt: finalImagePrompt,
                negative_prompt: scene.negative_prompt || undefined,
                reference_images: referenceImages,
                ...characterReferenceFields,
                style_reference_image: referenceImages.find((item) => item.kind === 'style')?.file_path,
                location_reference_image: referenceImages.find((item) => item.kind === 'location')?.file_path,
                size: imageSize,
                n: 1,
              }
        ),
      })

      const rawText = await response.text()
      let data: any = null

      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        throw new Error(`Image provider returned non-JSON response: ${rawText.slice(0, 500)}`)
      }

      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message
              ? data.error.message
              : data?.message
                ? String(data.message)
                : `Image provider error HTTP ${response.status}: ${JSON.stringify(data)}`
        )
      }

      const imageValue = extractImageFromProviderResponse(data)
      const imageBuffer = await imageUrlToBuffer(imageValue)

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('No image returned from provider');
      }

      // Save the image
      const buffer = imageBuffer

      await ensureProjectDirs(projectId);
      const filePath = await saveImageFile(projectId, sceneId, buffer);
      const savedFileName = filePath.split(/[\\/]/).pop() || `${sceneId}.png`;

      // API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/image?file=${encodeURIComponent(savedFileName)}&v=${Date.now()}`;

      // Update scene with completed status
      await db.storyboardScene.update({
        where: { id: scene.id },
        data: {
          image_status: 'completed',
          image_path: apiPath,
          error_message: null,
        },
      });

      return NextResponse.json({
        ok: true,
        image_path: apiPath,
      });
    } catch (genError) {
      const errorMsg = genError instanceof Error ? genError.message : 'Unknown error';

      // Update scene with failed status
      await db.storyboardScene.update({
        where: { id: scene.id },
        data: {
          image_status: 'failed',
          error_message: errorMsg,
        },
      });

      throw genError;
    }
  } catch (error) {
    console.error('Generate image error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
