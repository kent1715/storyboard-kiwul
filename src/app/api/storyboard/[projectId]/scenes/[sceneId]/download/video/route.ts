import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVideoPath, fileExists } from '@/lib/file-storage';
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

    if (scene.video_status !== 'completed' || !scene.video_path) {
      return NextResponse.json(
        { ok: false, error: 'Video not available' },
        { status: 404 }
      );
    }

    // Try different extensions
    const extensions = ['mp4', 'webm', 'mov'];
    let filePath: string | null = null;

    for (const ext of extensions) {
      const testPath = getVideoPath(projectId, sceneId, ext);
      if (fileExists(testPath)) {
        filePath = testPath;
        break;
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { ok: false, error: 'Video file not found on disk' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type based on extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };

    const contentType = contentTypes[ext || 'mp4'] || 'video/mp4';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sceneId}.${ext || 'mp4'}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Download video error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
