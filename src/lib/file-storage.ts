import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const OUTPUTS_DIR = path.join(process.cwd(), 'outputs', 'storyboard');

export function getProjectDir(projectId: string) {
  return path.join(OUTPUTS_DIR, projectId);
}

export function getImagesDir(projectId: string) {
  return path.join(getProjectDir(projectId), 'images');
}

export function getVideosDir(projectId: string) {
  return path.join(getProjectDir(projectId), 'videos');
}

export function getExportsDir(projectId: string) {
  return path.join(getProjectDir(projectId), 'exports');
}

export async function ensureProjectDirs(projectId: string) {
  const dirs = [
    getProjectDir(projectId),
    getImagesDir(projectId),
    getVideosDir(projectId),
    getExportsDir(projectId),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

export async function saveOriginalJSON(projectId: string, data: unknown) {
  await ensureProjectDirs(projectId);
  const filePath = path.join(getProjectDir(projectId), 'storyboard_original.json');
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

export async function saveFinalJSON(projectId: string, data: unknown) {
  await ensureProjectDirs(projectId);
  const filePath = path.join(getProjectDir(projectId), 'storyboard_final.json');
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

export async function readOriginalJSON(projectId: string) {
  const filePath = path.join(getProjectDir(projectId), 'storyboard_original.json');
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

function sleepMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function saveImageFile(projectId: string, sceneId: string, buffer: Buffer, ext: string = 'png') {
  await ensureProjectDirs(projectId);

  // Jangan overwrite file lama, karena di Windows file lama sering terkunci browser/preview.
  const safeSceneId = sceneId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeSceneId}_${Date.now()}.${ext}`;
  const filePath = path.join(getImagesDir(projectId), fileName);

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await writeFile(filePath, buffer);
      break;
    } catch (error: any) {
      if ((error?.code === 'EBUSY' || error?.code === 'EPERM') && attempt < 10) {
        console.warn(`[saveImageFile] ${error.code} on ${filePath}, retry ${attempt}/10`);
        await sleepMs(500);
        continue;
      }
      throw error;
    }
  }

  return filePath;
}

export async function saveVideoFile(projectId: string, sceneId: string, buffer: Buffer, ext: string = 'mp4') {
  await ensureProjectDirs(projectId);
  const filePath = path.join(getVideosDir(projectId), `${sceneId}.${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

export function getImagePath(projectId: string, sceneId: string, ext: string = 'png') {
  return path.join(getImagesDir(projectId), `${sceneId}.${ext}`);
}

export function getVideoPath(projectId: string, sceneId: string, ext: string = 'mp4') {
  return path.join(getVideosDir(projectId), `${sceneId}.${ext}`);
}

export function fileExists(filePath: string) {
  return existsSync(filePath);
}

export async function deleteFile(filePath: string) {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
