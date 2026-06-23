import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const scenes = await db.storyboardScene.findMany({
      where: {
        project_id: projectId,
      },
      orderBy: {
        scene_number: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      scenes,
    });
  } catch (error) {
    console.error('[storyboard scenes get]', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load scenes',
      },
      { status: 500 }
    );
  }
}
