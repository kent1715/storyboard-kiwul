import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/storyboard/[projectId]/update - Update project settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const project = await db.storyboardProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const allowedFields = [
      'title',
      'language',
      'aspect_ratio',
      'resolution',
      'duration_seconds',
      'style',
      'target_platform',
      'status',
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

    const updatedProject = await db.storyboardProject.update({
      where: { id: projectId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      project: updatedProject,
    });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
