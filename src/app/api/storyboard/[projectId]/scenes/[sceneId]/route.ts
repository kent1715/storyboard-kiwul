import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ALLOWED_FIELDS = [
  'vo',
  'duration',
  'image_prompt', 'background_prompt', 'background_negative_prompt',
  'video_prompt',
  'negative_prompt',
  'locked',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;
    const body = await request.json();

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

    const data: Record<string, any> = {};

    for (const field of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await db.storyboardScene.update({
      where: { id: scene.id },
      data,
    });

    return NextResponse.json({
      ok: true,
      scene: updated,
    });
  } catch (error) {
    console.error('Update scene error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
