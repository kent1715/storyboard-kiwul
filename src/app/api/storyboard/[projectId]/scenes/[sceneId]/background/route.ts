import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveImageFile, ensureProjectDirs } from '@/lib/file-storage';
import { Agent, fetch as undiciFetch } from 'undici';

function joinProviderUrl(baseUrl: string, endpoint: string | null | undefined): string {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const ep = String(endpoint || '/v1/images/generations');
  return `${base}${ep.startsWith('/') ? ep : `/${ep}`}`;
}

function authHeaders(apiKey: string | null | undefined): Record<string, string> {
  const key = String(apiKey || '').trim();
  if (!key || key === 'local' || key === 'none') return {};
  return { Authorization: `Bearer ${key}` };
}

async function imageUrlToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1] || '';
    return Buffer.from(base64, 'base64');
  }

  if (/^[A-Za-z]:\\/.test(url)) {
    const fs = await import('fs/promises');
    return fs.readFile(url);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download generated background: HTTP ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function extractImageFromProviderResponse(data: any): string {
  const first = data?.data?.[0] || data?.images?.[0] || data;

  const value =
    first?.b64_json ||
    first?.url ||
    first?.image ||
    first?.image_url ||
    first?.file_path ||
    first?.path ||
    data?.image_path ||
    data?.url;

  if (!value || typeof value !== 'string') {
    throw new Error('Background provider response did not contain image url/path/base64');
  }

  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  return value;
}

function buildBackgroundPrompt(scene: any): string {
  const sourcePrompt = String(scene.background_prompt || scene.image_prompt || '').trim();

  return [
    sourcePrompt,
    '',
    'Generate a clean storyboard background plate/environment only.',
    'Focus on location, mood, lighting, props, depth, and camera composition.',
    'Do not place the main character in the background.',
    'If the scene requires crowd or background people, they must be distant, blurred, bokeh, low detail, non-recognizable, and not the focus.',
    'No foreground person, no clear face, no person looking at camera, no posing character.',
    'Leave clear foreground space for the main characters to be added later.'
  ].join(' ');
}

function buildBackgroundNegativePrompt(scene: any): string {
  return [
    scene.background_negative_prompt || '',
    scene.negative_prompt || '',
    'foreground person, main character, clear face, recognizable face, person looking at camera, portrait, detailed human face, character posing, extra main subject, duplicate protagonist, pasted reference image, watermark, text'
  ].filter(Boolean).join(', ');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    const scene = await db.storyboardScene.findFirst({
      where: {
        project_id: projectId,
        scene_id: sceneId,
      },
    });

    if (!scene) {
      return NextResponse.json(
        { ok: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    const provider = await db.storyboardProvider.findFirst({
      where: {
        type: 'image',
        is_default: true,
        is_active: true,
      },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'Default image provider not found' },
        { status: 500 }
      );
    }

    await db.storyboardScene.update({
      where: { id: scene.id },
      data: {
        background_status: 'running',
        background_error_message: null,
      },
    });

    const projectRow = await (db as any).storyboardProject.findUnique({
      where: { id: projectId },
    }).catch(() => null as any);

    const projectAspectRatio =
      projectRow?.aspect_ratio ||
      projectRow?.aspectRatio ||
      projectRow?.resolution ||
      '9:16';

    const isLandscape = String(projectAspectRatio).includes('16:9');
    const imageWidth = isLandscape ? 1024 : 576;
    const imageHeight = isLandscape ? 576 : 1024;
    const imageSize = `${imageWidth}x${imageHeight}`;

    const prompt = buildBackgroundPrompt(scene);
    const negativePrompt = buildBackgroundNegativePrompt(scene);

    const url = joinProviderUrl(provider.base_url, provider.endpoint);
    const timeoutMs = Math.max(60, provider.timeout_seconds || 1200) * 1000;

    console.log('[background generation]', {
      projectId,
      sceneId,
      url,
      model: provider.model,
      imageSize,
      hasBackgroundPrompt: Boolean((scene as any).background_prompt),
    });

    const dispatcher = new Agent({
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });

    const response = await undiciFetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher: dispatcher as any,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(provider.api_key),
      },
      body: JSON.stringify({
        model: provider.model || 'z-image-turbo',
        prompt,
        negative_prompt: negativePrompt,
        size: imageSize,
        n: 1,
      }),
    });

    const rawText = await response.text();
    let data: any = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`Background provider returned non-JSON response: ${rawText.slice(0, 500)}`);
    }

    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.message
            ? data.error.message
            : data?.message
              ? String(data.message)
              : `Background provider error HTTP ${response.status}: ${JSON.stringify(data)}`
      );
    }

    const imageValue = extractImageFromProviderResponse(data);
    const imageBuffer = await imageUrlToBuffer(imageValue);

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('No background image returned from provider');
    }

    await ensureProjectDirs(projectId);

    const filePath = await saveImageFile(projectId, `${sceneId}_background`, imageBuffer);
    const backgroundDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const fsSync = await import('fs');

    if (!fsSync.existsSync(filePath)) {
      throw new Error(`Background file was not saved to disk: ${filePath}`);
    }

    await db.storyboardScene.update({
      where: { id: scene.id },
      data: {
        background_status: 'completed',
        background_path: backgroundDataUrl,
        background_error_message: null,
      },
    });

    console.log('[background generation completed]', {
      projectId,
      sceneId,
      backgroundPathPrefix: backgroundDataUrl.slice(0, 30),
      backgroundPathLength: backgroundDataUrl.length,
      file_exists: fsSync.existsSync(filePath),
    });

    return NextResponse.json({
      ok: true,
      background_path: backgroundDataUrl,
      file_exists: fsSync.existsSync(filePath),
    });
  } catch (error) {
    console.error('Generate background error:', error);

    try {
      const { projectId, sceneId } = await params;
      const scene = await db.storyboardScene.findFirst({
        where: { project_id: projectId, scene_id: sceneId },
      });

      if (scene) {
        await db.storyboardScene.update({
          where: { id: scene.id },
          data: {
            background_status: 'failed',
            background_error_message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch {}

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}