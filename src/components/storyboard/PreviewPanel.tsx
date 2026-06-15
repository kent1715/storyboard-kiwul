'use client';

import { useCallback } from 'react';
import {
  Download,
  RotateCcw,
  ImageIcon,
  FileImage,
  Film,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { toast } from 'sonner';

export function PreviewPanel() {
  const { scenes, selectedSceneId, currentProject, updateScene } = useStoryboardStore();
  const scene = scenes.find(s => s.scene_id === selectedSceneId) || null;

  const aspectRatio = currentProject?.aspect_ratio === '16:9' ? 16 / 9 : 9 / 16;

  const handleDownloadImage = useCallback(async () => {
    if (!scene?.image_path || !currentProject) return;
    try {
      const res = await fetch(
        `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/download/image`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scene.scene_id}_image.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('Failed to download image');
      }
    } catch {
      toast.error('Failed to download image');
    }
  }, [scene, currentProject]);

  const handleDownloadVideo = useCallback(async () => {
    if (!scene?.video_path || !currentProject) return;
    try {
      const res = await fetch(
        `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/download/video`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scene.scene_id}_video.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('Failed to download video');
      }
    } catch {
      toast.error('Failed to download video');
    }
  }, [scene, currentProject]);

  const handleRegenerateImage = useCallback(async () => {
    if (!scene || !currentProject) return;
    updateScene(scene.scene_id, { image_status: 'running', error_message: null });
    try {
      const res = await fetch(
        `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/image`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.ok) {
        updateScene(scene.scene_id, {
          image_status: 'completed',
          image_path: data.image_path,
          error_message: null,
        });
        toast.success('Image regenerated');
      } else {
        updateScene(scene.scene_id, {
          image_status: 'failed',
          error_message: data.error || 'Image regeneration failed',
        });
        toast.error(data.error || 'Failed to regenerate image');
      }
    } catch (err) {
      updateScene(scene.scene_id, {
        image_status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      });
      toast.error('Failed to regenerate image');
    }
  }, [scene, currentProject, updateScene]);

  const handleRegenerateVideo = useCallback(async () => {
    if (!scene || !currentProject) return;
    updateScene(scene.scene_id, { video_status: 'running', error_message: null });
    try {
      const res = await fetch(
        `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/video`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.ok) {
        updateScene(scene.scene_id, {
          video_status: 'completed',
          video_path: data.video_path,
          error_message: null,
        });
        toast.success('Video regenerated');
      } else {
        updateScene(scene.scene_id, {
          video_status: 'failed',
          error_message: data.error || 'Video regeneration failed',
        });
        toast.error(data.error || 'Failed to regenerate video');
      }
    } catch (err) {
      updateScene(scene.scene_id, {
        video_status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      });
      toast.error('Failed to regenerate video');
    }
  }, [scene, currentProject, updateScene]);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileImage className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a scene to preview</p>
        </div>
      </div>
    );
  }

  const imageUrl = scene.image_path
    ? `/api/storyboard/${currentProject?.id}/scenes/${scene.scene_id}/download/image`
    : null;
  const videoUrl = scene.video_path
    ? `/api/storyboard/${currentProject?.id}/scenes/${scene.scene_id}/download/video`
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Image Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Image Preview
              </h3>
              {scene.image_status === 'running' && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </span>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <AspectRatio ratio={aspectRatio} className="bg-black/5 dark:bg-white/5">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Scene ${scene.scene_number} image`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {scene.image_status === 'pending'
                          ? 'Not generated yet'
                          : scene.image_status === 'running'
                          ? 'Generating...'
                          : scene.image_status === 'failed'
                          ? 'Generation failed'
                          : 'No image'}
                      </p>
                    </div>
                  </div>
                )}
              </AspectRatio>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 flex-1"
                onClick={handleDownloadImage}
                disabled={!imageUrl}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 flex-1"
                onClick={handleRegenerateImage}
                disabled={scene.locked || scene.image_status === 'running'}
              >
                {scene.image_status === 'running' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Regenerate
              </Button>
            </div>
          </div>

          <Separator />

          {/* Video Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Video Preview
              </h3>
              {scene.video_status === 'running' && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </span>
              )}
            </div>
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <AspectRatio ratio={aspectRatio} className="bg-black/5 dark:bg-white/5">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Film className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {scene.video_status === 'pending'
                          ? 'Not generated yet'
                          : scene.video_status === 'running'
                          ? 'Generating...'
                          : scene.video_status === 'failed'
                          ? 'Generation failed'
                          : scene.image_status !== 'completed'
                          ? 'Generate image first'
                          : 'No video'}
                      </p>
                    </div>
                  </div>
                )}
              </AspectRatio>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 flex-1"
                onClick={handleDownloadVideo}
                disabled={!videoUrl}
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 flex-1"
                onClick={handleRegenerateVideo}
                disabled={scene.locked || scene.image_status !== 'completed' || scene.video_status === 'running'}
              >
                {scene.video_status === 'running' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
