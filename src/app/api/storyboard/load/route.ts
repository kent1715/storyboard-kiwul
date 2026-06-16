import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateStoryboardJSON, parseStoryboardJSON } from '@/lib/validate-storyboard';
import { saveOriginalJSON } from '@/lib/file-storage';

interface StoryboardJSONInput {
  project: {
    title: string;
    language?: string;
    aspect_ratio?: string;
    resolution?: string;
    duration_seconds?: number;
    style?: string;
    target_platform?: string;
  };
  scenes: Array<{
    scene_id: string;
    scene_number?: number;
    duration: number;
    vo: string;
    image_prompt: string;
    video_prompt: string;
    negative_prompt?: string;
    image_status?: string;
    video_status?: string;
    locked?: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { json: jsonData } = body;

    if (!jsonData) {
      return NextResponse.json(
        { ok: false, error: 'Field "json" wajib ada' },
        { status: 400 }
      );
    }

    // Parse if string
    let parsed = jsonData;
    if (typeof jsonData === 'string') {
      const parseResult = parseStoryboardJSON(jsonData);
      if (parseResult.errors.length > 0) {
        return NextResponse.json(
          { ok: false, errors: parseResult.errors },
          { status: 400 }
        );
      }
      parsed = parseResult.data;
    }

    // Validate JSON structure
    const validation = validateStoryboardJSON(parsed);
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, errors: validation.errors, warnings: validation.warnings },
        { status: 400 }
      );
    }

    const data = parsed as StoryboardJSONInput;

    // Create project
    const project = await db.storyboardProject.create({
      data: {
        title: data.project.title,
        language: data.project.language || 'id',
        aspect_ratio: data.project.aspect_ratio || '9:16',
        resolution: data.project.resolution || '1080x1920',
        duration_seconds: data.project.duration_seconds || null,
        style: data.project.style || null,
        target_platform: data.project.target_platform || null,
        status: 'loaded',
      },
    });

    // Save original JSON
    const jsonPath = await saveOriginalJSON(project.id, parsed);

    // Update project with json path
    await db.storyboardProject.update({
      where: { id: project.id },
      data: { json_path: jsonPath },
    });

    // Create scenes
    const scenesData = data.scenes.map((scene, index) => ({
      project_id: project.id,
      scene_id: scene.scene_id,
      scene_number: scene.scene_number || index + 1,
      duration: scene.duration,
      vo: scene.vo,
      image_prompt: scene.image_prompt,
      video_prompt: scene.video_prompt,
      negative_prompt: scene.negative_prompt || null,
      image_status: scene.image_status || 'pending',
      video_status: scene.video_status || 'pending',
      locked: scene.locked || false,
    }));

    await db.storyboardScene.createMany({ data: scenesData });

    // Fetch created scenes
    const scenes = await db.storyboardScene.findMany({
      where: { project_id: project.id },
      orderBy: { scene_number: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      project_id: project.id,
      scenes,
      warnings: validation.warnings,
    });
  } catch (error) {
    console.error('Load storyboard error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
