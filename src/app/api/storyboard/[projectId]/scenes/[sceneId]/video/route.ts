import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { saveVideoFile, ensureProjectDirs } from '@/lib/file-storage';


function extractVideoFromProviderResponse(data: any): string {
  const first = data?.data?.[0] || data?.videos?.[0] || data

  const value =
    first?.url ||
    first?.video_url ||
    first?.video_path ||
    first?.video ||
    first?.file_path ||
    first?.path ||
    first?.output ||
    data?.url ||
    data?.video_url ||
    data?.video_path ||
    data?.file_path ||
    data?.path ||
    data?.output

  if (!value || typeof value !== 'string') {
    throw new Error(`Unexpected video provider response format: ${JSON.stringify(data).slice(0, 1000)}`)
  }

  return value
}

async function videoValueToBuffer(value: string): Promise<Buffer> {
  if (value.startsWith('data:')) {
    const base64 = value.split(',')[1] || ''
    return Buffer.from(base64, 'base64')
  }

  if (/^[A-Za-z]:\\/.test(value)) {
    const fs = await import('fs/promises')
    return fs.readFile(value)
  }

  const res = await fetch(value)
  if (!res.ok) {
    throw new Error(`Failed to download video: HTTP ${res.status}`)
  }

  return Buffer.from(await res.arrayBuffer())
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isVideoDone(data: any): boolean {
  const status = String(data?.status || data?.state || '').toLowerCase()
  return ['completed', 'complete', 'succeeded', 'success', 'done', 'finished'].includes(status)
}

function isVideoFailed(data: any): boolean {
  const status = String(data?.status || data?.state || '').toLowerCase()
  return ['failed', 'error', 'cancelled', 'canceled'].includes(status)
}

function getVideoTaskId(data: any): string | null {
  return data?.task_id || data?.id || data?.job_id || null
}

function buildPollUrls(baseUrl: string, endpoint: string, taskId: string): string[] {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const ep = String(endpoint || '/v1/videos/generations')
  const fullEndpoint = `${base}${ep.startsWith('/') ? ep : `/${ep}`}`

  return Array.from(new Set([
    `${fullEndpoint}/${taskId}`,
    `${base}/v1/videos/generations/${taskId}`,
    `${base}/v1/videos/${taskId}`,
    `${base}/v1/tasks/${taskId}`,
    `${base}/tasks/${taskId}`,
  ]))
}

async function pollVideoUntilReady(
  initialData: any,
  baseUrl: string,
  endpoint: string,
  apiKey: string | null,
  timeoutSeconds: number
): Promise<any> {
  let data = initialData
  const taskId = getVideoTaskId(data)

  if (!taskId) return data
  if (isVideoDone(data)) return data
  if (isVideoFailed(data)) {
    throw new Error(`Video provider failed: ${JSON.stringify(data).slice(0, 1000)}`)
  }

  const pollUrls = buildPollUrls(baseUrl, endpoint, taskId)
  const started = Date.now()
  const timeoutMs = Math.max(60, timeoutSeconds || 1200) * 1000

  while (Date.now() - started < timeoutMs) {
    await sleep(5000)

    let lastError = ''

    for (const pollUrl of pollUrls) {
      try {
        const res = await fetch(pollUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(apiKey && apiKey !== 'local' ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        })

        if (!res.ok) {
          lastError = `HTTP ${res.status} from ${pollUrl}`
          continue
        }

        const text = await res.text()
        const nextData = text ? JSON.parse(text) : null

        if (nextData) {
          data = nextData
        }

        if (isVideoFailed(data)) {
          throw new Error(`Video provider failed: ${JSON.stringify(data).slice(0, 1000)}`)
        }

        if (isVideoDone(data) || data?.url || data?.video_url || data?.output || data?.file_path || data?.download_url || data?.data?.[0]?.url) {
          return data
        }

        const progress = data?.progress ?? '?'
        console.log(`[video poll] task=${taskId} status=${data?.status || data?.state} progress=${progress}`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.startsWith('Video provider failed:')) {
          throw err
        }
        lastError = msg
      }
    }

    if (lastError) {
      console.log(`[video poll] waiting task=${taskId}; last error: ${lastError}`)
    }
  }

  throw new Error(`Video generation timeout waiting for task ${taskId}. Last response: ${JSON.stringify(data).slice(0, 1000)}`)
}


async function imagePathToDataUrl(imagePath: string, requestUrl: string): Promise<string> {
  const absoluteUrl = imagePath.startsWith('http')
    ? imagePath
    : new URL(imagePath, requestUrl).toString()

  const res = await fetch(absoluteUrl)
  if (!res.ok) {
    throw new Error(`Failed to read input image for video: HTTP ${res.status}`)
  }

  const contentType = res.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await res.arrayBuffer())
  const base64 = buffer.toString('base64')

  return `data:${contentType};base64,${base64}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    // Regenerate Video: remove old video file and reset DB state before starting a new generation
    try {
      const oldVideoFile = path.join(
        process.cwd(),
        'outputs',
        'storyboard',
        projectId,
        'videos',
        `${sceneId}.mp4`
      );

      await fs.unlink(oldVideoFile).catch(() => null);

      await db.storyboardScene.updateMany({
        where: {
          project_id: projectId,
          scene_id: sceneId,
        },
        data: {
          video_status: 'pending',
          video_path: null,
          error_message: null,
        },
      });
    } catch (resetError) {
      console.warn('[regenerate video reset warning]', resetError);
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

    // Check if image exists
    if (scene.image_status !== 'completed' || !scene.image_path) {
      return NextResponse.json(
        { ok: false, error: 'Image must be generated before video' },
        { status: 400 }
      );
    }

    // Get default video provider
    const provider = await db.storyboardProvider.findFirst({
      where: { type: 'video', is_default: true, is_active: true },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'No active default video provider found' },
        { status: 400 }
      );
    }

    // Update scene status to running
    await db.storyboardScene.update({
      where: { id: scene.id },
      data: { video_status: 'running' },
    });

    try {
      // Call video provider API directly
      const endpoint = provider.endpoint || '/v1/videos/generations';
      const url = `${provider.base_url}${endpoint}`;

      console.log('[video provider]', {
        url,
        model: provider.model,
        endpoint,
        image_path: scene.image_path,
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

      const videoWidth = isLandscape ? 768 : 432
      const videoHeight = isLandscape ? 432 : 768
      const videoAspectRatio = isLandscape ? '16:9' : '9:16'

      console.log('[video aspect]', {
        projectId,
        projectAspectRatio,
        videoWidth,
        videoHeight,
        videoAspectRatio,
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.api_key && provider.api_key !== 'local'
            ? { Authorization: `Bearer ${provider.api_key}` }
            : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          prompt: scene.video_prompt,
          image: await imagePathToDataUrl(scene.image_path || '', request.url),
          image_url: scene.image_path?.startsWith('http')
            ? scene.image_path
            : new URL(scene.image_path || '', request.url).toString(),
          input_image: await imagePathToDataUrl(scene.image_path || '', request.url),
          duration: scene.duration,
          quality: 'standard',
          preset: 'standard',
          width: videoWidth,
          height: videoHeight,
          fps: 16,
          aspect_ratio: videoAspectRatio,
        }),
        signal: AbortSignal.timeout(provider.timeout_seconds * 1000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Video provider error: ${response.status} - ${errorText}`);
      }

      let data = await response.json();

      data = await pollVideoUntilReady(
        data,
        provider.base_url,
        endpoint,
        provider.api_key,
        provider.timeout_seconds || 1200
      );

      // Handle different response formats
      const videoValue = extractVideoFromProviderResponse(data)
      const videoBuffer = await videoValueToBuffer(videoValue)

      if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error('No video data returned from provider')
      }

      await ensureProjectDirs(projectId);
      const filePath = await saveVideoFile(projectId, sceneId, videoBuffer);

      // API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/video?v=${Date.now()}`;

      // Update scene with completed status
      await db.storyboardScene.update({
        where: { id: scene.id },
        data: {
          video_status: 'completed',
          video_path: apiPath,
          error_message: null,
        },
      });

      return NextResponse.json({
        ok: true,
        video_path: apiPath,
      });
    } catch (genError) {
      const errorMsg = genError instanceof Error ? genError.message : 'Unknown error';

      // Update scene with failed status
      await db.storyboardScene.update({
        where: { id: scene.id },
        data: {
          video_status: 'failed',
          error_message: errorMsg,
        },
      });

      throw genError;
    }
  } catch (error) {
    console.error('Generate video error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
