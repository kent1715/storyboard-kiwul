import { db } from '@/lib/db';
import { JobStatus, TaskStatus } from '@/types/storyboard';
import { appendReferenceContextToPrompt } from '@/lib/reference-context';
import { buildReferenceImagePayload, buildCharacterReferenceFields } from '@/lib/reference-payload';
import { saveImageFile, ensureProjectDirs } from '@/lib/file-storage';

interface QueueTask {
  taskId: string;
  jobId: string;
  projectId: string;
  sceneId: string;
  taskType: 'image' | 'video';
}


function joinProviderUrl(baseUrl: string, endpoint: string | null | undefined): string {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const ep = String(endpoint || '/v1/images/generations')
  return `${base}${ep.startsWith('/') ? ep : `/${ep}`}`
}

function authHeaders(apiKey: string | null | undefined): Record<string, string> {
  const key = String(apiKey || '').trim()
  if (!key || key === 'local' || key === 'none') return {}
  return { Authorization: `Bearer ${key}` }
}

function extractImageFromProviderResponse(data: any): string {
  const first = data?.data?.[0] || data?.images?.[0] || data
  const value =
    first?.b64_json ||
    first?.url ||
    first?.image ||
    first?.image_url ||
    first?.file_path ||
    first?.path ||
    data?.image_path ||
    data?.url

  if (!value || typeof value !== 'string') {
    throw new Error('Image provider response did not contain image url/path/base64')
  }

  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`
  return value
}

class StoryboardQueue {
  private processing = false;
  private currentJobId: string | null = null;
  private paused = false;
  private stopped = false;

  async enqueueJob(jobId: string): Promise<void> {
    // Mark job as running
    await db.storyboardJob.update({
      where: { id: jobId },
      data: { status: 'running' as JobStatus },
    });

    this.currentJobId = jobId;
    this.paused = false;
    this.stopped = false;

    // Start processing in background
    this.processQueue(jobId).catch(console.error);
  }

  private async processQueue(jobId: string): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (!this.stopped) {
        // Check if paused
        if (this.paused) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Get next queued task
        const task = await db.storyboardTask.findFirst({
          where: { job_id: jobId, status: 'queued' as TaskStatus },
          orderBy: { created_at: 'asc' },
        });

        if (!task) {
          // No more tasks - check if all completed
          const pendingTasks = await db.storyboardTask.count({
            where: { job_id: jobId, status: { in: ['queued', 'running'] } },
          });

          if (pendingTasks === 0) {
            const completedCount = await db.storyboardTask.count({
              where: { job_id: jobId, status: 'completed' },
            });
            const failedCount = await db.storyboardTask.count({
              where: { job_id: jobId, status: 'failed' },
            });

            await db.storyboardJob.update({
              where: { id: jobId },
              data: {
                status: 'completed' as JobStatus,
                completed_tasks: completedCount,
                failed_tasks: failedCount,
              },
            });
          }
          break;
        }

        // Mark task as running
        await db.storyboardTask.update({
          where: { id: task.id },
          data: {
            status: 'running' as TaskStatus,
            started_at: new Date(),
          },
        });

        // Update scene status
        if (task.task_type === 'image') {
          await db.storyboardScene.updateMany({
            where: { project_id: task.scene_id.split('_')[0], scene_id: task.scene_id },
            data: { image_status: 'running' },
          });
          // Actually find the scene properly
          const job = await db.storyboardJob.findUnique({ where: { id: jobId } });
          if (job) {
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: { image_status: 'running' },
            });
          }
        } else {
          const job = await db.storyboardJob.findUnique({ where: { id: jobId } });
          if (job) {
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: { video_status: 'running' },
            });
          }
        }

        // Process the task
        try {
          const result = await this.processTask({
            taskId: task.id,
            jobId,
            projectId: (await db.storyboardJob.findUnique({ where: { id: jobId } }))!.project_id,
            sceneId: task.scene_id,
            taskType: task.task_type as 'image' | 'video',
          });

          // Mark task as completed
          await db.storyboardTask.update({
            where: { id: task.id },
            data: {
              status: 'completed' as TaskStatus,
              output_path: result.outputPath,
              completed_at: new Date(),
            },
          });

          // Update job progress
          await db.storyboardJob.update({
            where: { id: jobId },
            data: {
              completed_tasks: { increment: 1 },
            },
          });

          // Update scene status
          if (task.task_type === 'image') {
            const job = (await db.storyboardJob.findUnique({ where: { id: jobId } }))!;
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: {
                image_status: 'completed',
                image_path: result.outputPath,
                error_message: null,
              },
            });
          } else {
            const job = (await db.storyboardJob.findUnique({ where: { id: jobId } }))!;
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: {
                video_status: 'completed',
                video_path: result.outputPath,
                error_message: null,
              },
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';

          // Mark task as failed
          await db.storyboardTask.update({
            where: { id: task.id },
            data: {
              status: 'failed' as TaskStatus,
              error_message: errorMsg,
              completed_at: new Date(),
            },
          });

          // Update job progress
          await db.storyboardJob.update({
            where: { id: jobId },
            data: {
              failed_tasks: { increment: 1 },
            },
          });

          // Update scene status
          if (task.task_type === 'image') {
            const job = (await db.storyboardJob.findUnique({ where: { id: jobId } }))!;
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: {
                image_status: 'failed',
                error_message: errorMsg,
              },
            });
          } else {
            const job = (await db.storyboardJob.findUnique({ where: { id: jobId } }))!;
            await db.storyboardScene.updateMany({
              where: { project_id: job.project_id, scene_id: task.scene_id },
              data: {
                video_status: 'failed',
                error_message: errorMsg,
              },
            });
          }
        }
      }
    } finally {
      this.processing = false;
      this.currentJobId = null;
    }
  }

  private async processTask(task: QueueTask): Promise<{ outputPath: string }> {
    const { projectId, sceneId, taskType } = task;

    // Get scene data
    const scene = await db.storyboardScene.findFirst({
      where: { project_id: projectId, scene_id: sceneId },
    });

    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`);
    }

    if (scene.locked) {
      throw new Error(`Scene ${sceneId} is locked`);
    }

    // Get provider
    const provider = await db.storyboardProvider.findFirst({
      where: { type: taskType, is_default: true, is_active: true },
    });

    if (!provider) {
      throw new Error(`No active default ${taskType} provider found`);
    }

    if (taskType === 'image') {
      return this.generateImage(projectId, sceneId, scene, provider);
    } else {
      return this.generateVideo(projectId, sceneId, scene, provider);
    }
  }

  private async generateImage(
    projectId: string,
    sceneId: string,
    scene: { project_id: string; image_prompt: string; negative_prompt: string | null },
    provider: { base_url: string; endpoint: string | null; model: string; api_key: string | null; timeout_seconds: number }
  ): Promise<{ outputPath: string }> {
    const url = joinProviderUrl(provider.base_url, provider.endpoint);

    try {
      const projectRow = await db.storyboardProject.findUnique({
        where: { id: projectId },
      }).catch(() => null as any);

      const projectAspectRatio =
        projectRow?.aspect_ratio ||
        projectRow?.aspectRatio ||
        projectRow?.aspect_ratio_value ||
        projectRow?.format ||
        projectRow?.resolution ||
        projectRow?.video_aspect_ratio ||
        '9:16';

      const isLandscape = String(projectAspectRatio).includes('16:9');
      const imageSize = isLandscape ? '1024x576' : '576x1024';

      const finalImagePrompt = await appendReferenceContextToPrompt(scene.project_id, scene.image_prompt || '');
      const referenceImages = await buildReferenceImagePayload(scene.project_id, sceneId);
      const characterReferenceFields = buildCharacterReferenceFields(referenceImages);

      console.log('[queue image aspect]', {
        projectId,
        sceneId,
        projectAspectRatio,
        imageSize,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(provider.api_key),
        },
        body: JSON.stringify({
          model: provider.model || 'z-image-turbo',
          prompt: finalImagePrompt,
          negative_prompt: scene.negative_prompt || undefined,
          reference_images: referenceImages,
          ...characterReferenceFields,
          style_reference_image: referenceImages.find((item) => item.kind === 'style')?.file_path,
          location_reference_image: referenceImages.find((item) => item.kind === 'location')?.file_path,
          size: imageSize,
          n: 1,
        }),
        signal: AbortSignal.timeout((provider.timeout_seconds || 600) * 1000),
      });

      const rawText = await response.text();
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(`Image provider returned non-JSON response: ${rawText.slice(0, 500)}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Image provider error HTTP ${response.status}`);
      }

      const imageValue = extractImageFromProviderResponse(data);

      if (!imageValue || typeof imageValue !== 'string') {
        throw new Error('No image returned from provider');
      }

      let buffer: Buffer;

      if (imageValue.startsWith('data:')) {
        const base64 = imageValue.split(',')[1] || '';
        buffer = Buffer.from(base64, 'base64');
      } else if (/^[A-Za-z]:\\/.test(imageValue)) {
        const fs = await import('fs/promises');
        buffer = await fs.readFile(imageValue);
      } else {
        const imageResponse = await fetch(imageValue);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: HTTP ${imageResponse.status}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error('No image data returned from provider');
      }

      await ensureProjectDirs(projectId);
      const filePath = await saveImageFile(projectId, sceneId, buffer);
      const savedFileName = filePath.split(/[\\/]/).pop() || `${sceneId}.png`;

      // Return API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/image?file=${encodeURIComponent(savedFileName)}&v=${Date.now()}`;
      return { outputPath: apiPath };
    } catch (error) {
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateVideo(
    projectId: string,
    sceneId: string,
    scene: { video_prompt: string; image_path: string | null; duration: number },
    provider: { base_url: string; endpoint: string | null; model: string; api_key: string | null; timeout_seconds: number }
  ): Promise<{ outputPath: string }> {
    if (!scene.image_path) {
      throw new Error('Image must be generated before video');
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const extractVideoValue = (data: any): string | null => {
      const first = data?.data?.[0] || data?.videos?.[0] || data;

      const value =
        first?.b64_json ||
        first?.url ||
        first?.video_url ||
        first?.video ||
        first?.video_path ||
        first?.file_path ||
        first?.path ||
        first?.output_path ||
        first?.download_url ||
        data?.url ||
        data?.video_url ||
        data?.video_path ||
        data?.file_path ||
        data?.path ||
        data?.output_path ||
        data?.download_url;

      return typeof value === 'string' && value.length > 0 ? value : null;
    };

    const fetchJson = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          ...(provider.api_key && provider.api_key !== 'local'
            ? { Authorization: `Bearer ${provider.api_key}` }
            : {}),
        },
        cache: 'no-store',
      });

      const rawText = await res.text();
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(`Video provider returned non-JSON response: ${rawText.slice(0, 500)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Video provider error HTTP ${res.status}`);
      }

      return data;
    };

    try {
      const endpoint = provider.endpoint || '/v1/videos/generations';
      const baseUrl = provider.base_url.replace(/\/+$/, '');
      const url = `${baseUrl}${endpoint}`;

      const projectRow = await db.storyboardProject.findUnique({
        where: { id: projectId },
      }).catch(() => null as any);

      const projectAspectRatio =
        projectRow?.aspect_ratio ||
        projectRow?.aspectRatio ||
        projectRow?.resolution ||
        '9:16';

      const videoAspectRatio = String(projectAspectRatio).includes('16:9') ? '16:9' : '9:16';

      const imageUrl = String(scene.image_path).startsWith('http')
        ? String(scene.image_path)
        : `http://127.0.0.1:3000${scene.image_path}`;

      console.log('[queue video request]', {
        projectId,
        sceneId,
        url,
        model: provider.model,
        videoAspectRatio,
        imageUrl,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.api_key && provider.api_key !== 'local'
            ? { Authorization: `Bearer ${provider.api_key}` }
            : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          prompt: scene.video_prompt,
          image_url: imageUrl,
          duration: scene.duration,
          aspect_ratio: videoAspectRatio,
        }),
        signal: AbortSignal.timeout((provider.timeout_seconds || 3600) * 1000),
      });

      const rawText = await response.text();
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(`Video provider returned non-JSON response: ${rawText.slice(0, 500)}`);
      }

      console.log('[queue video submit response]', {
        projectId,
        sceneId,
        status: response.status,
        data,
      });

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Video provider error HTTP ${response.status}`);
      }

      let finalData = data;
      let videoValue = extractVideoValue(finalData);

      const jobId =
        data?.id ||
        data?.task_id ||
        data?.job_id ||
        data?.data?.[0]?.id ||
        data?.data?.[0]?.task_id;

      const initialStatus = String(data?.status || data?.state || '').toLowerCase();

      if (!videoValue && jobId && ['processing', 'queued', 'running', 'pending', 'started'].includes(initialStatus)) {
        const pollUrl = `${baseUrl}/v1/videos/${jobId}`;
        const timeoutMs = (provider.timeout_seconds || 3600) * 1000;
        const startedAt = Date.now();

        console.log('[queue video polling start]', {
          projectId,
          sceneId,
          jobId,
          pollUrl,
          timeoutMs,
        });

        let pollCount = 0;

        while (Date.now() - startedAt < timeoutMs) {
          pollCount++;

          await sleep(5000);

          const pollData = await fetchJson(pollUrl);
          finalData = pollData;

          const pollStatus = String(pollData?.status || pollData?.state || '').toLowerCase();
          videoValue = extractVideoValue(pollData);

          console.log('[queue video poll]', {
            projectId,
            sceneId,
            pollCount,
            pollStatus,
            progress: pollData?.progress,
            hasVideo: !!videoValue,
          });

          if (videoValue) {
            break;
          }

          if (['failed', 'error', 'cancelled', 'canceled'].includes(pollStatus)) {
            throw new Error(`Video provider failed: ${JSON.stringify(pollData).slice(0, 500)}`);
          }
        }
      }

      if (!videoValue || typeof videoValue !== 'string') {
        throw new Error(`Video provider finished without video URL/path: ${JSON.stringify(finalData).slice(0, 500)}`);
      }

      console.log('[queue video value]', {
        projectId,
        sceneId,
        videoValue,
      });

      let videoBuffer: Buffer;

      if (videoValue.startsWith('data:')) {
        const base64 = videoValue.split(',')[1] || '';
        videoBuffer = Buffer.from(base64, 'base64');
      } else if (/^[A-Za-z]:\\/.test(videoValue)) {
        const fs = await import('fs/promises');
        videoBuffer = await fs.readFile(videoValue);
      } else {
        const videoUrl = videoValue.startsWith('http')
          ? videoValue
          : `${baseUrl}/${videoValue.replace(/^\/+/, '')}`;

        const videoResponse = await fetch(videoUrl);

        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: HTTP ${videoResponse.status} from ${videoUrl}`);
        }

        const arrayBuffer = await videoResponse.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuffer);
      }

      if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error('No video data returned from provider');
      }

      const { saveVideoFile, ensureProjectDirs } = await import('@/lib/file-storage');
      await ensureProjectDirs(projectId);

      await saveVideoFile(projectId, sceneId, videoBuffer);

      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/video?v=${Date.now()}`;
      return { outputPath: apiPath };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Video provider timeout');
      }

      throw new Error(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pauseJob(jobId: string): Promise<void> {
    this.paused = true;
    await db.storyboardJob.update({
      where: { id: jobId },
      data: { status: 'paused' as JobStatus },
    });
  }

  async resumeJob(jobId: string): Promise<void> {
    this.paused = false;
    await db.storyboardJob.update({
      where: { id: jobId },
      data: { status: 'running' as JobStatus },
    });
  }

  async stopJob(jobId: string): Promise<void> {
    this.stopped = true;
    this.paused = false;

    // Cancel remaining queued tasks
    await db.storyboardTask.updateMany({
      where: { job_id: jobId, status: 'queued' as TaskStatus },
      data: { status: 'cancelled' as TaskStatus },
    });

    await db.storyboardJob.update({
      where: { id: jobId },
      data: { status: 'stopped' as JobStatus },
    });
  }

  isProcessing(): boolean {
    return this.processing;
  }

  getCurrentJobId(): string | null {
    return this.currentJobId;
  }
}

// Singleton instance
export const storyboardQueue = new StoryboardQueue();
