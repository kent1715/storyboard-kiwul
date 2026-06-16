import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getImagePath, fileExists } from '@/lib/file-storage';
import { readFile } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    // Verify scene exists
    const scene = await db.storyboardScene.findFirst({
      where: { project_id: projectId, scene_id: sceneId },
    });

    if (!scene) {
      return NextResponse.json(
        { ok: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    if (scene.image_status !== 'completed' || !scene.image_path) {
      return NextResponse.json(
        { ok: false, error: 'Image not available' },
        { status: 404 }
      );
    }

    // Try different extensions
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    let filePath: string | null = null;

    for (const ext of extensions) {
      const testPath = getImagePath(projectId, sceneId, ext);
      if (fileExists(testPath)) {
        filePath = testPath;
        break;
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { ok: false, error: 'Image file not found on disk' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type based on extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    const contentType = contentTypes[ext || 'png'] || 'image/png';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sceneId}.${ext || 'png'}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Download image error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
