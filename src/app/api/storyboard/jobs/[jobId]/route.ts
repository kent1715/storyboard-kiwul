import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { JobProgress } from '@/types/storyboard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await db.storyboardJob.findUnique({
      where: { id: jobId },
      include: {
        tasks: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Count tasks by status
    const totalTasks = job.tasks.length;
    const completedTasks = job.tasks.filter((t) => t.status === 'completed').length;
    const failedTasks = job.tasks.filter((t) => t.status === 'failed').length;
    const queuedTasks = job.tasks.filter((t) => t.status === 'queued').length;
    const runningTasks = job.tasks.filter((t) => t.status === 'running').length;

    // Get unique scene IDs from tasks and fetch their current statuses
    const sceneIds = [...new Set(job.tasks.map((t) => t.scene_id))];

    const scenes = await db.storyboardScene.findMany({
      where: {
        project_id: job.project_id,
        scene_id: { in: sceneIds },
      },
      select: {
        scene_id: true,
        image_status: true,
        video_status: true,
        image_path: true,
        video_path: true,
        error_message: true,
      },
    });

    const progress: JobProgress = {
      job_id: job.id,
      status: job.status as JobProgress['status'],
      progress: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        queued_tasks: queuedTasks,
        running_tasks: runningTasks,
      },
      updated_scenes: scenes.map((s) => ({
        scene_id: s.scene_id,
        image_status: s.image_status,
        video_status: s.video_status,
        image_path: s.image_path,
        video_path: s.video_path,
        error_message: s.error_message,
      })),
    };

    return NextResponse.json({
      ok: true,
      ...progress,
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
