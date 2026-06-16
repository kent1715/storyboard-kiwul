import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storyboardQueue } from '@/lib/storyboard-queue';
import { GenerateMode } from '@/types/storyboard';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

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

    const body = await request.json();
    const mode: GenerateMode = body.mode || 'image_and_video';
    const skip_locked: boolean = body.skip_locked ?? true;
    const failed_only: boolean = body.failed_only ?? false;
    const concurrency = body.concurrency || { image: 1, video: 1 };

    // Get all scenes for the project
    const scenes = await db.storyboardScene.findMany({
      where: { project_id: projectId },
      orderBy: { scene_number: 'asc' },
    });

    // Determine job type based on mode
    let jobType: string;
    switch (mode) {
      case 'image':
        jobType = 'generate_all_images';
        break;
      case 'video':
        jobType = 'generate_all_videos';
        break;
      case 'image_and_video':
        jobType = 'generate_all';
        break;
      case 'failed_only':
        jobType = 'generate_failed';
        break;
      default:
        jobType = 'generate_all';
    }

    // Filter eligible scenes
    const eligibleScenes = scenes.filter((scene) => {
      // Skip locked scenes if configured
      if (skip_locked && scene.locked) return false;

      if (failed_only) {
        // Only include scenes with failed status
        if (mode === 'image' || mode === 'image_and_video') {
          if (scene.image_status !== 'failed') return false;
        }
        if (mode === 'video' || mode === 'image_and_video') {
          if (scene.video_status !== 'failed') return false;
        }
        if (mode === 'failed_only') {
          if (scene.image_status !== 'failed' && scene.video_status !== 'failed') return false;
        }
      } else {
        // Include scenes that need generation
        if (mode === 'image' || mode === 'image_and_video' || mode === 'failed_only') {
          if (scene.image_status === 'completed') {
            if (mode === 'image') return false;
          }
        }
        if (mode === 'video' || mode === 'image_and_video' || mode === 'failed_only') {
          if (scene.video_status === 'completed') {
            if (mode === 'video') return false;
          }
          // Video requires image to be completed
          if (scene.image_status !== 'completed') {
            if (mode === 'video') return false;
          }
        }
      }

      return true;
    });

    if (eligibleScenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No eligible scenes found' },
        { status: 400 }
      );
    }

    // Build tasks list
    const tasks: Array<{ scene_id: string; task_type: 'image' | 'video' }> = [];

    for (const scene of eligibleScenes) {
      if (mode === 'image' || mode === 'image_and_video' || mode === 'failed_only') {
        const needsImage = failed_only
          ? scene.image_status === 'failed'
          : scene.image_status !== 'completed';
        if (needsImage) {
          tasks.push({ scene_id: scene.scene_id, task_type: 'image' });
        }
      }
      if (mode === 'video' || mode === 'image_and_video' || mode === 'failed_only') {
        const needsVideo = failed_only
          ? scene.video_status === 'failed'
          : scene.video_status !== 'completed';
        if (needsVideo && scene.image_status === 'completed') {
          tasks.push({ scene_id: scene.scene_id, task_type: 'video' });
        }
      }
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No tasks to generate' },
        { status: 400 }
      );
    }

    // Create job
    const job = await db.storyboardJob.create({
      data: {
        project_id: projectId,
        type: jobType,
        status: 'queued',
        total_tasks: tasks.length,
        completed_tasks: 0,
        failed_tasks: 0,
        config_json: JSON.stringify({ mode, skip_locked, failed_only, concurrency }),
      },
    });

    // Create tasks
    const tasksData = tasks.map((task) => ({
      job_id: job.id,
      scene_id: task.scene_id,
      task_type: task.task_type,
      status: 'queued',
    }));

    await db.storyboardTask.createMany({ data: tasksData });

    // Enqueue the job
    await storyboardQueue.enqueueJob(job.id);

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      total_tasks: tasks.length,
    });
  } catch (error) {
    console.error('Generate all error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
