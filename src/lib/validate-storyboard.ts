import { ValidationResult, StoryboardJSON, ASPECT_RATIOS } from '@/types/storyboard';

export function validateStoryboardJSON(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['JSON harus berupa object'], warnings: [] };
  }

  const json = data as Record<string, unknown>;

  // 2. Check project exists
  if (!json.project || typeof json.project !== 'object') {
    errors.push('Field "project" wajib ada dan berupa object');
  } else {
    const project = json.project as Record<string, unknown>;
    if (!project.title || typeof project.title !== 'string') {
      errors.push('Field "project.title" wajib ada dan berupa string');
    }
    if (project.aspect_ratio && typeof project.aspect_ratio === 'string') {
      if (!Object.keys(ASPECT_RATIOS).includes(project.aspect_ratio)) {
        errors.push(`Aspect ratio "${project.aspect_ratio}" tidak valid. Hanya mendukung: ${Object.keys(ASPECT_RATIOS).join(', ')}`);
      }
    }
  }

  // 3. Check scenes exists and is array
  if (!json.scenes || !Array.isArray(json.scenes)) {
    errors.push('Field "scenes" wajib ada dan berupa array');
    return { valid: false, errors, warnings };
  }

  // 4. Minimum 1 scene
  if (json.scenes.length === 0) {
    errors.push('Minimal 1 scene diperlukan');
  }

  const sceneIds = new Set<string>();
  let totalDuration = 0;

  json.scenes.forEach((scene: unknown, index: number) => {
    if (!scene || typeof scene !== 'object') {
      errors.push(`Scene ke-${index + 1} harus berupa object`);
      return;
    }

    const s = scene as Record<string, unknown>;

    // 5. Check scene_id
    if (!s.scene_id || typeof s.scene_id !== 'string') {
      errors.push(`Scene ke-${index + 1}: field "scene_id" wajib ada dan berupa string`);
    } else {
      // 10. Check duplicate scene_id
      if (sceneIds.has(s.scene_id as string)) {
        errors.push(`Scene ID "${s.scene_id}" duplikat`);
      }
      sceneIds.add(s.scene_id as string);
    }

    // 6. Check vo
    if (!s.vo || typeof s.vo !== 'string') {
      errors.push(`Scene ke-${index + 1} (${s.scene_id || 'unknown'}): field "vo" wajib ada dan berupa string`);
    }

    // 7. Check image_prompt
    if (!s.image_prompt || typeof s.image_prompt !== 'string') {
      errors.push(`Scene ke-${index + 1} (${s.scene_id || 'unknown'}): field "image_prompt" wajib ada dan berupa string`);
    }

    // 8. Check video_prompt
    if (!s.video_prompt || typeof s.video_prompt !== 'string') {
      errors.push(`Scene ke-${index + 1} (${s.scene_id || 'unknown'}): field "video_prompt" wajib ada dan berupa string`);
    }

    // 9. Check duration
    if (s.duration === undefined || s.duration === null || typeof s.duration !== 'number') {
      errors.push(`Scene ke-${index + 1} (${s.scene_id || 'unknown'}): field "duration" wajib ada dan berupa number`);
    } else {
      totalDuration += s.duration as number;
    }
  });

  // 12. Duration validation
  if (totalDuration < 30) {
    warnings.push('Durasi terlalu pendek. Minimum 30 detik.');
  }
  if (totalDuration > 900) {
    warnings.push('Durasi terlalu panjang. Maximum 15 menit (900 detik).');
  }

  // 13. Compare project duration with scene total
  if (json.project && typeof json.project === 'object') {
    const project = json.project as Record<string, unknown>;
    if (project.duration_seconds && typeof project.duration_seconds === 'number') {
      if (Math.abs((project.duration_seconds as number) - totalDuration) > 1) {
        warnings.push('Durasi project tidak sama dengan total durasi scene.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function parseStoryboardJSON(jsonString: string): { data: StoryboardJSON | null; errors: string[] } {
  try {
    const parsed = JSON.parse(jsonString);
    return { data: parsed as StoryboardJSON, errors: [] };
  } catch (e) {
    return { data: null, errors: [`JSON tidak valid: ${(e as Error).message}`] };
  }
}
