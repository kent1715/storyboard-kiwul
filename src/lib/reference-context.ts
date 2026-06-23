import fs from 'fs/promises';
import path from 'path';

type ReferenceItem = {
  id?: string;
  kind?: string;
  file_name?: string;
  original_name?: string;
  url?: string;
};

export async function buildReferencePromptContext(projectId: string) {
  try {
    const manifestPath = path.join(
      process.cwd(),
      'outputs',
      'storyboard',
      projectId,
      'references',
      'references.json'
    );

    const raw = await fs.readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    const references: ReferenceItem[] = Array.isArray(data.references) ? data.references : [];

    if (!references.length) {
      return '';
    }

    const characterRefs = references.filter((item) => item.kind === 'character');
    const styleRefs = references.filter((item) => item.kind === 'style');
    const locationRefs = references.filter((item) => item.kind === 'location');

    const lines: string[] = [];

    lines.push('');
    lines.push('REFERENCE IMAGE INSTRUCTION:');

    if (characterRefs.length) {
      lines.push(
        '- Character reference images are uploaded for this project. If there is one reference, keep the main character consistent with it. If there are two character references, treat them as two different people: Character 1 follows the first reference file, Character 2 follows the second reference file.'
      );
      lines.push(
        `- Character reference files: ${characterRefs.map((item) => item.file_name).join(', ')}`
      );
    }

    if (styleRefs.length) {
      lines.push(
        '- A style reference image is uploaded for this project. Match the overall visual style, color palette, lighting mood, contrast, and cinematic atmosphere from the style reference.'
      );
      lines.push(
        `- Style reference files: ${styleRefs.map((item) => item.file_name).join(', ')}`
      );
    }

    if (locationRefs.length) {
      lines.push(
        '- A location reference image is uploaded for this project. Keep environment layout, architecture, background feeling, and place continuity consistent with the location reference.'
      );
      lines.push(
        `- Location reference files: ${locationRefs.map((item) => item.file_name).join(', ')}`
      );
    }

    lines.push(
      '- For two-character scenes: Character 1 should appear on the left and Character 2 on the right whenever possible. Keep both identities distinct. Do not blend, merge, average, duplicate, or confuse their faces. Do not make both characters look like the same person. Keep continuity strong across scenes.'
    );

    return lines.join('\n');
  } catch {
    return '';
  }
}

export async function appendReferenceContextToPrompt(projectId: string, prompt: string) {
  const context = await buildReferencePromptContext(projectId);
  if (!context) return prompt;
  return `${prompt}\n\n${context}`;
}
