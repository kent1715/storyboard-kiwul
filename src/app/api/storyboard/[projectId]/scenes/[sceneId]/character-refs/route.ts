import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReferenceItem = {
  id?: string;
  kind?: string;
  file_name?: string;
  original_name?: string;
  name?: string;
  role?: string;
  url?: string;
};

type SceneCharacterRefsManifest = {
  scenes: Record<string, string[]>;
};

function getReferencesDir(projectId: string) {
  return path.join(process.cwd(), 'outputs', 'storyboard', projectId, 'references');
}

function getReferencesManifestPath(projectId: string) {
  return path.join(getReferencesDir(projectId), 'references.json');
}

function getSceneRefsPath(projectId: string) {
  return path.join(getReferencesDir(projectId), 'scene-character-refs.json');
}

async function readReferences(projectId: string): Promise<ReferenceItem[]> {
  try {
    const raw = await fs.readFile(getReferencesManifestPath(projectId), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.references) ? data.references : [];
  } catch {
    return [];
  }
}

async function readSceneRefs(projectId: string): Promise<SceneCharacterRefsManifest> {
  try {
    const raw = await fs.readFile(getSceneRefsPath(projectId), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data.scenes === 'object' ? data : { scenes: {} };
  } catch {
    return { scenes: {} };
  }
}

async function writeSceneRefs(projectId: string, data: SceneCharacterRefsManifest) {
  const dir = getReferencesDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getSceneRefsPath(projectId), JSON.stringify(data, null, 2), 'utf8');
}

function normalizeCharacterRefs(value: unknown) {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 2);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;

    const references = await readReferences(projectId);
    const characters = references.filter((item) => item.kind === 'character' && item.id);

    const sceneRefs = await readSceneRefs(projectId);
    const selected = sceneRefs.scenes[sceneId] || [];

    return NextResponse.json(
      {
        ok: true,
        scene_id: sceneId,
        characters,
        character_refs: selected.slice(0, 2),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[scene character refs GET]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to get scene character refs' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> }
) {
  try {
    const { projectId, sceneId } = await params;
    const body = await req.json().catch(() => ({}));

    const requested = normalizeCharacterRefs(body.character_refs);

    const references = await readReferences(projectId);
    const validIds = new Set(
      references
        .filter((item) => item.kind === 'character' && item.id)
        .map((item) => String(item.id))
    );

    const selected = requested.filter((id) => validIds.has(id)).slice(0, 2);

    const sceneRefs = await readSceneRefs(projectId);

    if (selected.length) {
      sceneRefs.scenes[sceneId] = selected;
    } else {
      delete sceneRefs.scenes[sceneId];
    }

    await writeSceneRefs(projectId, sceneRefs);

    return NextResponse.json({
      ok: true,
      scene_id: sceneId,
      character_refs: selected,
      manifest: sceneRefs,
    });
  } catch (error) {
    console.error('[scene character refs POST]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save scene character refs' },
      { status: 500 }
    );
  }
}
