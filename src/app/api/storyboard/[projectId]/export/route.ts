import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveFinalJSON, ensureProjectDirs } from '@/lib/file-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Fetch project with all scenes
    const project = await db.storyboardProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          orderBy: { scene_number: 'asc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build the final JSON structure
    const finalJSON = {
      project: {
        title: project.title,
        language: project.language,
        aspect_ratio: project.aspect_ratio,
        resolution: project.resolution,
        duration_seconds: project.duration_seconds,
        style: project.style,
        target_platform: project.target_platform,
      },
      scenes: project.scenes.map((scene) => ({
        scene_id: scene.scene_id,
        scene_number: scene.scene_number,
        duration: scene.duration,
        vo: scene.vo,
        image_prompt: scene.image_prompt,
      background_prompt: scene.background_prompt,
      background_negative_prompt: scene.background_negative_prompt,
        video_prompt: scene.video_prompt,
        negative_prompt: scene.negative_prompt,
        locked: scene.locked,
        image_status: scene.image_status,
        video_status: scene.video_status,
        image_path: scene.image_path,
        video_path: scene.video_path,
        error_message: scene.error_message,
      })),
      export_info: {
        exported_at: new Date().toISOString(),
        project_id: project.id,
        total_scenes: project.scenes.length,
        total_duration: project.scenes.reduce((sum, s) => sum + s.duration, 0),
        completed_images: project.scenes.filter((s) => s.image_status === 'completed').length,
        completed_videos: project.scenes.filter((s) => s.video_status === 'completed').length,
      },
    };

    // Save the final JSON
    await ensureProjectDirs(projectId);
    const filePath = await saveFinalJSON(projectId, finalJSON);

    // Update project with final JSON path
    await db.storyboardProject.update({
      where: { id: projectId },
      data: { final_json_path: filePath, status: 'exported' },
    });

    return NextResponse.json(finalJSON);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
