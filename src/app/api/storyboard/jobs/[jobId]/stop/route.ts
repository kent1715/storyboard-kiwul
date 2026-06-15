import { NextRequest, NextResponse } from 'next/server';
import { storyboardQueue } from '@/lib/storyboard-queue';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    await storyboardQueue.stopJob(jobId);

    return NextResponse.json({
      ok: true,
      message: 'Job stopped',
    });
  } catch (error) {
    console.error('Stop job error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
