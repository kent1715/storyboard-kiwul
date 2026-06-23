import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReferenceItem = {
  id: string;
  kind: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
};

const ALLOWED_KINDS = new Set(['character', 'style', 'location', 'other']);
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function getReferencesDir(projectId: string) {
  return path.join(process.cwd(), 'outputs', 'storyboard', projectId, 'references');
}

function getManifestPath(projectId: string) {
  return path.join(getReferencesDir(projectId), 'references.json');
}

async function readManifest(projectId: string): Promise<ReferenceItem[]> {
  try {
    const raw = await fs.readFile(getManifestPath(projectId), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.references) ? data.references : [];
  } catch {
    return [];
  }
}

async function writeManifest(projectId: string, references: ReferenceItem[]) {
  const dir = getReferencesDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    getManifestPath(projectId),
    JSON.stringify({ references }, null, 2),
    'utf8'
  );
}

function contentTypeFromExt(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const fileName = req.nextUrl.searchParams.get('file');

    if (fileName) {
      const safeName = path.basename(fileName);
      const filePath = path.join(getReferencesDir(projectId), safeName);
      const buffer = await fs.readFile(filePath);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentTypeFromExt(safeName),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Content-Disposition': `inline; filename="${safeName}"`,
        },
      });
    }

    const references = await readManifest(projectId);

    return NextResponse.json(
      {
        ok: true,
        references,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[references GET]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to get references' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const form = await req.formData();

    const file = form.get('file');
    const rawKind = String(form.get('kind') || 'other').toLowerCase();
    const kind = ALLOWED_KINDS.has(rawKind) ? rawKind : 'other';

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'File reference tidak ditemukan' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'reference.png';
    const ext = path.extname(originalName).toLowerCase() || '.png';

    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { ok: false, error: 'Format harus PNG, JPG, JPEG, atau WEBP' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      return NextResponse.json(
        { ok: false, error: 'File kosong' },
        { status: 400 }
      );
    }

    const dir = getReferencesDir(projectId);
    await fs.mkdir(dir, { recursive: true });

    const id = crypto.randomUUID();
    const fileName = `${kind}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(dir, fileName);

    await fs.writeFile(filePath, buffer);

    const references = await readManifest(projectId);

    const item: ReferenceItem = {
      id,
      kind,
      file_name: fileName,
      original_name: originalName,
      mime_type: file.type || contentTypeFromExt(fileName),
      size_bytes: buffer.length,
      url: `/api/storyboard/${projectId}/references?file=${encodeURIComponent(fileName)}&v=${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    references.unshift(item);
    await writeManifest(projectId, references);

    return NextResponse.json({
      ok: true,
      reference: item,
      references,
    });
  } catch (error) {
    console.error('[references POST]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to upload reference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const fileName = req.nextUrl.searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { ok: false, error: 'Parameter file wajib diisi' },
        { status: 400 }
      );
    }

    const safeName = path.basename(fileName);
    const filePath = path.join(getReferencesDir(projectId), safeName);

    await fs.unlink(filePath).catch(() => null);

    const references = await readManifest(projectId);
    const nextReferences = references.filter((item) => item.file_name !== safeName);

    await writeManifest(projectId, nextReferences);

    return NextResponse.json({
      ok: true,
      references: nextReferences,
    });
  } catch (error) {
    console.error('[references DELETE]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete reference' },
      { status: 500 }
    );
  }
}
