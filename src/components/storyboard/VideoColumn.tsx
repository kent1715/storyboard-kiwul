'use client';

import { useCallback, useState } from 'react';
import {
  Download,
  Film,
  Loader2,
  RefreshCw,
  Play,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { toast } from 'sonner';

export function VideoColumn() {
  const { scenes, currentProject, updateScene } = useStoryboardStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAllVideos, setGeneratingAllVideos] = useState(false);

  const aspectRatio = currentProject?.aspect_ratio === '16:9' ? 16 / 9 : 9 / 16;

  const handleGenerateVideo = useCallback(
    async (sceneId: string) => {
      if (!currentProject) return;
      setGenerating(sceneId);
      updateScene(sceneId, { video_status: 'running', error_message: null });
      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${sceneId}/video`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (data.ok) {
          updateScene(sceneId, {
            video_status: 'completed',
            video_path: data.video_path,
            error_message: null,
          });
          toast.success('Video berhasil dibuat');
        } else {
          updateScene(sceneId, {
            video_status: 'failed',
            error_message: data.error || 'Gagal membuat video',
          });
          toast.error(data.error || 'Gagal membuat video');
        }
      } catch (err) {
        updateScene(sceneId, {
          video_status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
        toast.error('Gagal membuat video');
      } finally {
        setGenerating(null);
      }
    },
    [currentProject, updateScene]
  );

  const handleGenerateAllVideosColumn = useCallback(async () => {
    if (!currentProject) {
      toast.error('Project belum dipilih');
      return;
    }

    if (!scenes.length) {
      toast.error('Tidak ada scene');
      return;
    }

    setGeneratingAllVideos(true);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const scene of scenes) {
        if (scene.locked) continue;

        if (scene.image_status !== 'completed') {
          skippedCount++;
          continue;
        }

        setGenerating(scene.scene_id);
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
            successCount++;
          } else {
            updateScene(scene.scene_id, {
              video_status: 'failed',
              error_message: data.error || 'Gagal membuat video',
            });
            failedCount++;
          }
        } catch (err) {
          updateScene(scene.scene_id, {
            video_status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          });
          failedCount++;
        }
      }

      if (failedCount > 0 || skippedCount > 0) {
        toast.error(`Generate video selesai: ${successCount} sukses, ${failedCount} gagal, ${skippedCount} dilewati`);
      } else {
        toast.success(`Semua video selesai: ${successCount} scene`);
      }
    } finally {
      setGenerating(null);
      setGeneratingAllVideos(false);
    }
  }, [currentProject, scenes, updateScene]);

  const handleDownloadVideo = useCallback(
    async (sceneId: string, sceneNumber: number) => {
      if (!currentProject) return;
      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${sceneId}/download/video?v=${Date.now()}`
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `scene_${sceneNumber}_video.mp4`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          toast.error('Gagal mengunduh video');
        }
      } catch {
        toast.error('Gagal mengunduh video');
      }
    },
    [currentProject]
  );

  return (
    <div className="p-3 space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2">
        <Button
          variant="default"
          size="sm"
          className="w-full h-8 text-xs gap-1"
          disabled={generatingAllVideos || Boolean(generating)}
          onClick={handleGenerateAllVideosColumn}
        >
          {generatingAllVideos ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate All Videos
        </Button>
      </div>
      {scenes.map((scene) => {
        const videoUrl = scene.video_path
          ? `/api/storyboard/${currentProject?.id}/scenes/${scene.scene_id}/download/video?v=${Date.now()}`
          : null;
        const isGenerating = generating === scene.scene_id;

        return (
          <div
            key={scene.scene_id}
            className="rounded-xl border border-border bg-card p-3 space-y-2.5"
          >
            {/* Scene Number Label */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                Scene #{String(scene.scene_number).padStart(2, '0')}
              </span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>

            {/* Video Preview */}
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
                      {isGenerating ? (
                        <Loader2 className="h-8 w-8 mx-auto text-blue-500/50 animate-spin" />
                      ) : scene.image_status !== 'completed' ? (
                        <Film className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      ) : (
                        <div className="h-10 w-10 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Play className="h-4 w-4 text-blue-500 ml-0.5" />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {scene.video_status === 'pending'
                          ? scene.image_status !== 'completed'
                            ? 'Buat gambar dulu'
                            : 'Belum Dibuat'
                          : scene.video_status === 'running'
                          ? 'Memproses...'
                          : scene.video_status === 'failed'
                          ? 'Gagal'
                          : 'Tidak ada video'}
                      </p>
                    </div>
                  </div>
                )}
              </AspectRatio>
            </div>

            {/* Prompt Motion */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Prompt Motion
              </p>
              <Textarea
                value={scene.video_prompt || ''}
                onChange={(e) =>
                  updateScene(scene.scene_id, { video_prompt: e.target.value })
                }
                onBlur={async (e) => {
                  if (!currentProject) return;
                  const value = e.target.value;
                  const res = await fetch(`/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_prompt: value }),
                  });
                  const data = await res.json();
                  if (!data.ok) {
                    toast.error(data.error || 'Gagal menyimpan prompt video');
                  } else {
                    toast.success('Prompt video tersimpan');
                  }
                }}
                className="min-h-[88px] text-xs resize-y"
                placeholder="Edit prompt video..."
                disabled={isGenerating || scene.video_status === 'running'}
              />
            </div>

            {/* Duration */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Film className="h-3 w-3" />
              <span>{scene.duration} detik</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!videoUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                  onClick={() => handleGenerateVideo(scene.scene_id)}
                  disabled={isGenerating || scene.locked || scene.image_status !== 'completed' || generatingAllVideos}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Generate Video
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => handleGenerateVideo(scene.scene_id)}
                    disabled={isGenerating || scene.locked || generatingAllVideos}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => handleDownloadVideo(scene.scene_id, scene.scene_number)}
                    disabled={!videoUrl}
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
