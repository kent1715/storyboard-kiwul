import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const projects = await db.storyboardProject.findMany({
      select: {
        id: true,
        title: true,
        language: true,
        aspect_ratio: true,
        resolution: true,
        duration_seconds: true,
        style: true,
        target_platform: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { scenes: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        language: p.language,
        aspect_ratio: p.aspect_ratio,
        resolution: p.resolution,
        duration_seconds: p.duration_seconds,
        style: p.style,
        target_platform: p.target_platform,
        status: p.status,
        scene_count: p._count.scenes,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    });
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
