import fs from 'fs/promises';
import path from 'path';

type ReferenceItem = {
  id?: string;
  kind?: string;
  role?: string;
  name?: string;
  file_name?: string;
  original_name?: string;
  url?: string;
};

export type ReferencePayloadItem = {
  id?: string;
  kind: string;
  role?: string;
  name?: string;
  file_name: string;
  original_name?: string;
  file_path: string;
  strength: number;
};

type SceneCharacterRefsManifest = {
  scenes?: Record<string, string[]>;
};

function strengthForKind(kind: string) {
  if (kind === 'character') return 0.72;
  if (kind === 'style') return 0.45;
  if (kind === 'location') return 0.55;
  return 0.5;
}

function getReferencesDir(projectId: string) {
  return path.join(
    process.cwd(),
    'outputs',
    'storyboard',
    projectId,
    'references'
  );
}

async function readSelectedCharacterIds(projectId: string, sceneId?: string) {
  if (!sceneId) return [];

  try {
    const file = path.join(getReferencesDir(projectId), 'scene-character-refs.json');
    const raw = await fs.readFile(file, 'utf8');
    const data: SceneCharacterRefsManifest = JSON.parse(raw);
    const ids = data.scenes?.[sceneId];
    return Array.isArray(ids) ? ids.map((id) => String(id)).filter(Boolean).slice(0, 2) : [];
  } catch {
    return [];
  }
}

async function readAllReferences(projectId: string): Promise<ReferencePayloadItem[]> {
  try {
    const referencesDir = getReferencesDir(projectId);
    const manifestPath = path.join(referencesDir, 'references.json');
    const raw = await fs.readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    const references: ReferenceItem[] = Array.isArray(data.references) ? data.references : [];

    const result: ReferencePayloadItem[] = [];

    for (const item of references) {
      if (!item.file_name) continue;

      const safeName = path.basename(item.file_name);
      const filePath = path.join(referencesDir, safeName);

      try {
        await fs.access(filePath);
      } catch {
        continue;
      }

      const kind = String(item.kind || 'other');

      result.push({
        id: item.id,
        kind,
        role: item.role,
        name: item.name,
        file_name: safeName,
        original_name: item.original_name,
        file_path: filePath,
        strength: strengthForKind(kind),
      });
    }

    return result;
  } catch {
    return [];
  }
}

export async function buildReferenceImagePayload(
  projectId: string,
  sceneId?: string
): Promise<ReferencePayloadItem[]> {
  const allReferences = await readAllReferences(projectId);
  const selectedCharacterIds = await readSelectedCharacterIds(projectId, sceneId);

  if (!selectedCharacterIds.length) {
    return allReferences;
  }

  const selectedCharacters = selectedCharacterIds
    .map((id) => allReferences.find((item) => item.id === id && item.kind === 'character'))
    .filter(Boolean) as ReferencePayloadItem[];

  const nonCharacters = allReferences.filter((item) => item.kind !== 'character');

  return [...selectedCharacters, ...nonCharacters];
}

export function pickCharacterReferences(
  references: ReferencePayloadItem[],
  maxCharacters = 2
) {
  return references
    .filter((item) => item.kind === 'character')
    .slice(0, maxCharacters);
}

export function buildCharacterReferenceFields(references: ReferencePayloadItem[]) {
  const characters = pickCharacterReferences(references, 2);

  return {
    character_reference_images: characters,
    character_reference_image: characters[0]?.file_path,
    character_reference_image_2: characters[1]?.file_path,
    character_reference_name: characters[0]?.name || characters[0]?.original_name,
    character_reference_name_2: characters[1]?.name || characters[1]?.original_name,
  };
}
