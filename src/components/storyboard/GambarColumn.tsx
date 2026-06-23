'use client';

import { useCallback, useState } from 'react';
import {
  Download,
  RotateCcw,
  ImageIcon,
  Loader2,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { SceneCharacterSelector } from './SceneCharacterSelector';
import { toast } from 'sonner';

export function GambarColumn() {
  const { scenes, currentProject, updateScene } = useStoryboardStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);

  const aspectRatio = currentProject?.aspect_ratio === '16:9' ? 16 / 9 : 9 / 16;

  const handleGenerateImage = useCallback(
    async (sceneId: string) => {
      if (!currentProject) return;
      setGenerating(sceneId);
      updateScene(sceneId, { image_status: 'running', error_message: null });
      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${sceneId}/image`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (data.ok) {
          updateScene(sceneId, {
            image_status: 'completed',
            image_path: data.image_path,
            error_message: null,
          });
          toast.success('Gambar berhasil dibuat');
        } else {
          updateScene(sceneId, {
            image_status: 'failed',
            error_message: data.error || 'Gagal membuat gambar',
          });
          toast.error(data.error || 'Gagal membuat gambar');
        }
      } catch (err) {
        updateScene(sceneId, {
          image_status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
        toast.error('Gagal membuat gambar');
      } finally {
        setGenerating(null);
      }
    },
    [currentProject, updateScene]
  );

  const handleGenerateAllImagesColumn = useCallback(async () => {
    if (!currentProject) {
      toast.error('Project belum dipilih');
      return;
    }

    if (!scenes.length) {
      toast.error('Tidak ada scene');
      return;
    }

    setGeneratingAllImages(true);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const scene of scenes) {
        if (scene.locked) continue;

        setGenerating(scene.scene_id);
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
            successCount++;
          } else {
            updateScene(scene.scene_id, {
              image_status: 'failed',
              error_message: data.error || 'Gagal membuat gambar',
            });
            failedCount++;
          }
        } catch (err) {
          updateScene(scene.scene_id, {
            image_status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          });
          failedCount++;
        }
      }

      if (failedCount > 0) {
        toast.error(`Generate image selesai: ${successCount} sukses, ${failedCount} gagal`);
      } else {
        toast.success(`Semua image selesai: ${successCount} scene`);
      }
    } finally {
      setGenerating(null);
      setGeneratingAllImages(false);
    }
  }, [currentProject, scenes, updateScene]);

  const handleDownloadImage = useCallback(
    async (sceneId: string, sceneNumber: number) => {
      if (!currentProject) return;
      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${sceneId}/download/image`
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `scene_${sceneNumber}_image.png`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          toast.error('Gagal mengunduh gambar');
        }
      } catch {
        toast.error('Gagal mengunduh gambar');
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
          disabled={generatingAllImages || Boolean(generating)}
          onClick={handleGenerateAllImagesColumn}
        >
          {generatingAllImages ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate All Images
        </Button>
      </div>
      {scenes.map((scene) => {
        const imageUrl = scene.image_path || null;
        const isGenerating = generating === scene.scene_id;

        return (
          <div
            key={scene.scene_id}
            className="rounded-xl border border-border bg-card p-3 space-y-2.5"
          >
            {/* Scene Number Label */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Scene #{String(scene.scene_number).padStart(2, '0')}
              </span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>

            {/* Image Preview */}
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <AspectRatio ratio={aspectRatio} className="bg-black/5 dark:bg-white/5">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Scene ${scene.scene_number}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      {isGenerating ? (
                        <Loader2 className="h-8 w-8 mx-auto text-emerald-500/50 animate-spin" />
                      ) : (
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {scene.image_status === 'pending'
                          ? 'Belum Dibuat'
                          : scene.image_status === 'running'
                          ? 'Memproses...'
                          : scene.image_status === 'failed'
                          ? 'Gagal'
                          : 'Tidak ada gambar'}
                      </p>
                    </div>
                  </div>
                )}
              </AspectRatio>
            </div>

            {/* Prompt Gambar */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Prompt Gambar
              </p>
              <Textarea
                value={scene.image_prompt || ''}
                onChange={(e) =>
                  updateScene(scene.scene_id, { image_prompt: e.target.value })
                }
                onBlur={async (e) => {
                  if (!currentProject) return;
                  const value = e.target.value;
                  const res = await fetch(`/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_prompt: value }),
                  });
                  const data = await res.json();
                  if (!data.ok) {
                    toast.error(data.error || 'Gagal menyimpan prompt gambar');
                  } else {
                    toast.success('Prompt gambar tersimpan');
                  }
                }}
                className="min-h-[88px] text-xs resize-y"
                placeholder="Edit prompt gambar..."
                disabled={isGenerating || scene.image_status === 'running'}
              />
            </div>

            {/* Scene Character Reference */}
            {currentProject?.id && scene?.scene_id && (
              <SceneCharacterSelector
                projectId={currentProject.id}
                sceneId={scene.scene_id}
              />
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!imageUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                  onClick={() => handleGenerateImage(scene.scene_id)}
                  disabled={isGenerating || scene.locked || generatingAllImages}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Generate
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => handleGenerateImage(scene.scene_id)}
                    disabled={isGenerating || scene.locked || generatingAllImages}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] gap-1 flex-1"
                    onClick={() => handleDownloadImage(scene.scene_id, scene.scene_number)}
                    disabled={!imageUrl}
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
