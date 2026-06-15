import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Check project exists
    const project = await db.storyboardProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete project (cascade will delete scenes, jobs, tasks)
    await db.storyboardProject.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
