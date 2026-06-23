import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface SceneUpdate {
  scene_id: string;
  vo?: string;
  image_prompt?: string;
  video_prompt?: string;
  negative_prompt?: string | null;
  background_prompt?: string | null;
  background_negative_prompt?: string | null;
  background_path?: string | null;
  background_status?: string;
  background_error_message?: string | null;
  locked?: boolean;
  duration?: number;
  image_status?: string;
  video_status?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { scenes, project } = body as {
      scenes?: SceneUpdate[];
      project?: Record<string, unknown>;
    };

    // Verify project exists
    const existingProject = await db.storyboardProject.findUnique({
      where: { id: projectId },
    });

    if (!existingProject) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update project metadata if provided
    if (project) {
      const allowedFields = ['title', 'language', 'aspect_ratio', 'resolution', 'style', 'target_platform', 'status'];
      const projectUpdates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (project[key] !== undefined) {
          projectUpdates[key] = project[key];
        }
      }
      if (Object.keys(projectUpdates).length > 0) {
        await db.storyboardProject.update({
          where: { id: projectId },
          data: projectUpdates,
        });
      }
    }

    // Bulk update scenes if provided
    let updatedCount = 0;
    if (scenes && Array.isArray(scenes)) {
      for (const sceneUpdate of scenes) {
        if (!sceneUpdate.scene_id) continue;

        const data: Record<string, unknown> = {};
        const allowedFields = ['vo', 'image_prompt', 'video_prompt', 'negative_prompt', 'background_prompt', 'background_negative_prompt', 'background_path', 'background_status', 'background_error_message', 'locked', 'duration', 'image_status', 'video_status'];
        for (const key of allowedFields) {
          if (sceneUpdate[key as keyof SceneUpdate] !== undefined) {
            data[key] = sceneUpdate[key as keyof SceneUpdate];
          }
        }

        if (Object.keys(data).length > 0) {
          try {
            await db.storyboardScene.update({
              where: {
                project_id_scene_id: {
                  project_id: projectId,
                  scene_id: sceneUpdate.scene_id,
                },
              },
              data,
            });
            updatedCount++;
          } catch {
            // Scene not found, skip
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      updated_scenes: updatedCount,
    });
  } catch (error) {
    console.error('Save project error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
