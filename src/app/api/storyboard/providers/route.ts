import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/storyboard/providers - List providers
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // optional filter: "image" | "video"

    const where = type ? { type } : {};

    const providers = await db.storyboardProvider.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      providers,
    });
  } catch (error) {
    console.error('List providers error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/storyboard/providers - Create provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'type', 'provider', 'base_url', 'model'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { ok: false, error: `Field "${field}" is required` },
          { status: 400 }
        );
      }
    }

    // Validate type
    if (body.type !== 'image' && body.type !== 'video') {
      return NextResponse.json(
        { ok: false, error: 'Type must be "image" or "video"' },
        { status: 400 }
      );
    }

    // If this provider is set as default, unset other defaults of the same type
    if (body.is_default) {
      await db.storyboardProvider.updateMany({
        where: { type: body.type, is_default: true },
        data: { is_default: false },
      });
    }

    const provider = await db.storyboardProvider.create({
      data: {
        name: body.name,
        type: body.type,
        provider: body.provider,
        base_url: body.base_url,
        endpoint: body.endpoint || null,
        model: body.model,
        api_key: body.api_key || null,
        config_json: JSON.stringify(body.config_json || {}),
        is_default: body.is_default ?? false,
        is_active: body.is_active ?? true,
        timeout_seconds: body.timeout_seconds || 600,
      },
    });

    return NextResponse.json({
      ok: true,
      provider,
    });
  } catch (error) {
    console.error('Create provider error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
