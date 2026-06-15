import { db } from '@/lib/db';
import { JobStatus, TaskStatus } from '@/types/storyboard';

interface QueueTask {
  taskId: string;
  jobId: string;
  projectId: string;
  sceneId: string;
  taskType: 'image' | 'video';
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
    scene: { image_prompt: string; negative_prompt: string | null },
    provider: { base_url: string; endpoint: string | null; model: string; api_key: string | null; timeout_seconds: number }
  ): Promise<{ outputPath: string }> {
    const endpoint = provider.endpoint || '/v1/images/generations';
    const url = `${provider.base_url}${endpoint}`;

    // Use z-ai-web-dev-sdk for image generation
    const { ImageGen } = await import('z-ai-web-dev-sdk');
    const imageGen = new ImageGen();

    try {
      const result = await imageGen.generate({
        prompt: scene.image_prompt,
        negative_prompt: scene.negative_prompt || undefined,
        model: provider.model,
        size: '1024x1024',
      });

      if (!result || !result.images || result.images.length === 0) {
        throw new Error('No image returned from provider');
      }

      // Save the image
      const imageData = result.images[0];
      let buffer: Buffer;

      if (imageData.url) {
        // Download from URL
        const response = await fetch(imageData.url);
        if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (imageData.b64_json) {
        buffer = Buffer.from(imageData.b64_json, 'base64');
      } else {
        throw new Error('No image data returned from provider');
      }

      const { saveImageFile, ensureProjectDirs } = await import('@/lib/file-storage');
      await ensureProjectDirs(projectId);
      const filePath = await saveImageFile(projectId, sceneId, buffer);

      // Return API path for frontend
      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/image`;
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
    // For video generation, we need the image first
    if (!scene.image_path) {
      throw new Error('Image must be generated before video');
    }

    const { ImageGen } = await import('z-ai-web-dev-sdk');
    const imageGen = new ImageGen();

    try {
      // For video generation, we'll use the provider's API directly
      // since z-ai-web-dev-sdk might not have video generation
      // We'll use a compatible API approach
      const endpoint = provider.endpoint || '/v1/videos/generations';
      const url = `${provider.base_url}${endpoint}`;

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
          image_url: scene.image_path,
          duration: scene.duration,
          aspect_ratio: '9:16',
        }),
        signal: AbortSignal.timeout(provider.timeout_seconds * 1000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Video provider error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Handle different response formats
      let videoBuffer: Buffer;

      if (data.data && data.data[0]) {
        const videoData = data.data[0];
        if (videoData.url) {
          const videoResponse = await fetch(videoData.url);
          if (!videoResponse.ok) throw new Error('Failed to download video');
          const arrayBuffer = await videoResponse.arrayBuffer();
          videoBuffer = Buffer.from(arrayBuffer);
        } else if (videoData.b64_json) {
          videoBuffer = Buffer.from(videoData.b64_json, 'base64');
        } else {
          throw new Error('No video data in response');
        }
      } else {
        throw new Error('Unexpected video provider response format');
      }

      const { saveVideoFile, ensureProjectDirs } = await import('@/lib/file-storage');
      await ensureProjectDirs(projectId);
      const filePath = await saveVideoFile(projectId, sceneId, videoBuffer);

      const apiPath = `/api/storyboard/${projectId}/scenes/${sceneId}/download/video`;
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
