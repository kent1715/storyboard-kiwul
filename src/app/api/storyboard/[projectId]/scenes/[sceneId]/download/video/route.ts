import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    const filePath = path.join(
      process.cwd(),
      'outputs',
      'storyboard',
      projectId,
      'videos',
      `${sceneId}.mp4`
    );

    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const range = request.headers.get('range');

    const baseHeaders = {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'Accept-Ranges': 'bytes',
    };

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);

      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        const safeEnd = Math.min(end, stat.size - 1);
        const chunk = buffer.subarray(start, safeEnd + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${safeEnd}/${stat.size}`,
            'Content-Length': String(chunk.length),
          },
        });
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('[download video]', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Video not found',
      },
      { status: 404 }
    );
  }
}
