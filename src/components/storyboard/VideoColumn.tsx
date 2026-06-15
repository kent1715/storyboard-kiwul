'use client';

import { useCallback, useState } from 'react';
import {
  Download,
  Film,
  Loader2,
  Play,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { toast } from 'sonner';

export function VideoColumn() {
  const { scenes, currentProject, updateScene } = useStoryboardStore();
  const [generating, setGenerating] = useState<string | null>(null);

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

  const handleDownloadVideo = useCallback(
    async (sceneId: string, sceneNumber: number) => {
      if (!currentProject) return;
      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${sceneId}/download/video`
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
      {scenes.map((scene) => {
        const videoUrl = scene.video_path
          ? `/api/storyboard/${currentProject?.id}/scenes/${scene.scene_id}/download/video`
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
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {scene.video_prompt}
              </p>
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
                  disabled={isGenerating || scene.locked || scene.image_status !== 'completed'}
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
                    disabled={isGenerating || scene.locked}
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
