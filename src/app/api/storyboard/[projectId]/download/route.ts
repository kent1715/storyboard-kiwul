import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getImagesDir, getVideosDir, getExportsDir, ensureProjectDirs, fileExists } from '@/lib/file-storage';
import archiver from 'archiver';
import { ReadStream } from 'fs';
import { createReadStream, readdirSync, statSync } from 'fs';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'images';

    // Verify project exists
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

    await ensureProjectDirs(projectId);

    // Create a ZIP stream
    const archive = archiver('zip', { zlib: { level: 5 } });

    // Collect chunks
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const archiveDone = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    if (type === 'images') {
      // Add all images
      const imagesDir = getImagesDir(projectId);
      if (fileExists(imagesDir)) {
        const files = readdirSync(imagesDir);
        for (const file of files) {
          const filePath = join(imagesDir, file);
          const stat = statSync(filePath);
          if (stat.isFile()) {
            archive.append(createReadStream(filePath) as ReadStream, { name: file });
          }
        }
      }
    } else if (type === 'videos') {
      // Add all videos
      const videosDir = getVideosDir(projectId);
      if (fileExists(videosDir)) {
        const files = readdirSync(videosDir);
        for (const file of files) {
          const filePath = join(videosDir, file);
          const stat = statSync(filePath);
          if (stat.isFile()) {
            archive.append(createReadStream(filePath) as ReadStream, { name: file });
          }
        }
      }
    } else if (type === 'project') {
      // Add images
      const imagesDir = getImagesDir(projectId);
      if (fileExists(imagesDir)) {
        const files = readdirSync(imagesDir);
        for (const file of files) {
          const filePath = join(imagesDir, file);
          const stat = statSync(filePath);
          if (stat.isFile()) {
            archive.append(createReadStream(filePath) as ReadStream, { name: `images/${file}` });
          }
        }
      }

      // Add videos
      const videosDir = getVideosDir(projectId);
      if (fileExists(videosDir)) {
        const files = readdirSync(videosDir);
        for (const file of files) {
          const filePath = join(videosDir, file);
          const stat = statSync(filePath);
          if (stat.isFile()) {
            archive.append(createReadStream(filePath) as ReadStream, { name: `videos/${file}` });
          }
        }
      }

      // Add project JSON
      const projectJSON = {
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
        },
      };
      archive.append(JSON.stringify(projectJSON, null, 2), { name: 'project.json' });
    }

    await archive.finalize();
    const zipBuffer = await archiveDone;

    const filename = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_${type}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download ZIP error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
