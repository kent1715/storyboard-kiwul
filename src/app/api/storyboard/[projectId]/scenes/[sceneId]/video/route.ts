import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveVideoFile, ensureProjectDirs } from '@/lib/file-storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

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
          image_url: scene.image_path,
          duration: scene.duration,
          aspect_ratio: '9:16',
        }),
        signal: AbortSignal.timeout(provider.timeout_seconds * 1000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Video provider error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Handle different response formats
      let videoBuffer: Buffer;

      if (data.data && data.data[0]) {
        const videoData = data.data[0];
        if (videoData.url) {
          const videoResponse = await fetch(videoData.url);
          if (!videoResponse.ok) throw new Error('Failed to download video');
          const arrayBuffer = await videoResponse.arrayBuffer();
          videoBuffer = Buffer.from(arrayBuffer);
        } else if (videoData.b64_json) {
          videoBuffer = Buffer.from(videoData.b64_json, 'base64');
        } else {
          throw new Error('No video data in response');
        }
      } else {
        throw new Error('Unexpected video provider response format');
      }

      await ensureProjectDirs(projectId);
      const filePath = await saveVideoFile(projectId, sceneId, videoBuffer);

      // API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/video`;

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
