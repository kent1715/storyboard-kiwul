import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/storyboard/providers/[providerId] - Update provider
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;

    const provider = await db.storyboardProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'Provider not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // If setting as default, unset other defaults of the same type
    if (body.is_default) {
      const type = body.type || provider.type;
      await db.storyboardProvider.updateMany({
        where: { type, is_default: true },
        data: { is_default: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name',
      'type',
      'provider',
      'base_url',
      'endpoint',
      'model',
      'api_key',
      'config_json',
      'is_default',
      'is_active',
      'timeout_seconds',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'config_json' && typeof body[field] === 'object') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updatedProvider = await db.storyboardProvider.update({
      where: { id: providerId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      provider: updatedProvider,
    });
  } catch (error) {
    console.error('Update provider error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/storyboard/providers/[providerId] - Delete provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;

    const provider = await db.storyboardProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'Provider not found' },
        { status: 404 }
      );
    }

    await db.storyboardProvider.delete({
      where: { id: providerId },
    });

    return NextResponse.json({
      ok: true,
      message: 'Provider deleted',
    });
  } catch (error) {
    console.error('Delete provider error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
