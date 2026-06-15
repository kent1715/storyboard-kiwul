import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

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

    return NextResponse.json({
      ok: true,
      project: {
        id: project.id,
        title: project.title,
        language: project.language,
        aspect_ratio: project.aspect_ratio,
        resolution: project.resolution,
        duration_seconds: project.duration_seconds,
        style: project.style,
        target_platform: project.target_platform,
        status: project.status,
        json_path: project.json_path,
        final_json_path: project.final_json_path,
        created_at: project.created_at,
        updated_at: project.updated_at,
      },
      scenes: project.scenes,
    });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
