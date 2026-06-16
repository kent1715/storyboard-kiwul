import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
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

    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields = [
      'vo',
      'image_prompt',
      'video_prompt',
      'negative_prompt',
      'locked',
      'duration',
      'image_status',
      'video_status',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedScene = await db.storyboardScene.update({
      where: { id: scene.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      scene: updatedScene,
    });
  } catch (error) {
    console.error('Update scene error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
