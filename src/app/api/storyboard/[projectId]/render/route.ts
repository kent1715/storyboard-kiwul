import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

function ffmpegListPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const project = await db.storyboardProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const scenes = await db.storyboardScene.findMany({
      where: { project_id: projectId },
      orderBy: { scene_number: 'asc' },
      select: {
        scene_id: true,
        scene_number: true,
        video_status: true,
      },
    });

    const missingScenes: string[] = [];
    const videoFiles: string[] = [];

    for (const scene of scenes) {
      const videoFile = path.join(
        process.cwd(),
        'outputs',
        'storyboard',
        projectId,
        'videos',
        `${scene.scene_id}.mp4`
      );

      if (scene.video_status !== 'completed' || !(await fileExists(videoFile))) {
        missingScenes.push(scene.scene_id);
      } else {
        videoFiles.push(videoFile);
      }
    }

    if (missingScenes.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Some scene videos are not completed yet',
          missing_scenes: missingScenes,
          completed_count: videoFiles.length,
          total_scenes: scenes.length,
        },
        { status: 400 }
      );
    }

    const finalDir = path.join(process.cwd(), 'outputs', 'storyboard', projectId, 'final');
    await fs.mkdir(finalDir, { recursive: true });

    const concatFile = path.join(finalDir, 'concat.txt');
    const finalVideo = path.join(finalDir, 'final.mp4');

    const concatText = videoFiles
      .map(file => `file '${ffmpegListPath(file)}'`)
      .join('\n');

    await fs.writeFile(concatFile, concatText, 'utf8');

    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        finalVideo,
      ], {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20,
      });
    } catch (copyError) {
      console.warn('[render final] concat copy failed, retrying with re-encode', copyError);

      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFile,
        '-an',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '20',
        finalVideo,
      ], {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 50,
      });
    }

    const stat = await fs.stat(finalVideo);

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      total_scenes: scenes.length,
      output_path: `/api/storyboard/${projectId}/download/final?v=${Date.now()}`,
      file_size: stat.size,
      file_path: finalVideo,
    });
  } catch (error) {
    console.error('[render final video]', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to render final video',
      },
      { status: 500 }
    );
  }
}