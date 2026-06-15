import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveImageFile, ensureProjectDirs } from '@/lib/file-storage';

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
      // Use z-ai-web-dev-sdk for image generation
      const { ImageGen } = await import('z-ai-web-dev-sdk');
      const imageGen = new ImageGen();

      const result = await imageGen.generate({
        prompt: scene.image_prompt,
        negative_prompt: scene.negative_prompt || undefined,
        model: provider.model,
        size: '1024x1024',
      });

      if (!result || !result.images || result.images.length === 0) {
        throw new Error('No image returned from provider');
      }

      // Save the image
      const imageData = result.images[0];
      let buffer: Buffer;

      if (imageData.url) {
        const response = await fetch(imageData.url);
        if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (imageData.b64_json) {
        buffer = Buffer.from(imageData.b64_json, 'base64');
      } else {
        throw new Error('No image data returned from provider');
      }

      await ensureProjectDirs(projectId);
      const filePath = await saveImageFile(projectId, sceneId, buffer);

      // API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/image`;

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
