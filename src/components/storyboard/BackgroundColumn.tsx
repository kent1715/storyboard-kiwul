'use client';

import { useCallback, useState } from 'react';
import { ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStoryboardStore, SceneData } from '@/lib/store/storyboard-store';
import { SceneStatusBadge } from './SceneStatusBadge';
import { toast } from 'sonner';

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'Selesai';
    case 'running': return 'Diproses';
    case 'queued': return 'Antrian';
    case 'pending': return 'Menunggu';
    case 'failed': return 'Gagal';
    case 'skipped': return 'Dilewati';
    default: return status;
  }
}

export function BackgroundColumn() {
  const { scenes, selectedSceneId, selectScene, updateScene, currentProject } = useStoryboardStore();
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const handleFieldChange = useCallback(
    (sceneId: string, field: keyof SceneData, value: string | number | boolean) => {
      updateScene(sceneId, { [field]: value });
    },
    [updateScene]
  );

  const handleGenerateBackground = useCallback(
    async (scene: SceneData) => {
      if (!currentProject?.id) {
        toast.error('Project belum dipilih');
        return;
      }

      setGeneratingSceneId(scene.scene_id);

      updateScene(scene.scene_id, {
        background_status: 'running',
        background_error_message: null,
        error_message: null,
      });

      try {
        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/background`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }
        );

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || data.message || 'Background generation failed');
        }

        updateScene(scene.scene_id, {
          background_status: 'completed',
          background_path: data.background_path,
          background_error_message: null,
          image_status: 'pending',
          image_path: null,
          error_message: null,
        });

        toast.success(`Background ${scene.scene_id} selesai`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown background error';

        updateScene(scene.scene_id, {
          background_status: 'failed',
          background_error_message: message,
          error_message: message,
        });

        toast.error(message);
      } finally {
        setGeneratingSceneId(null);
      }
    },
    [currentProject, updateScene]
  );


  const handleGenerateAllBackgrounds = useCallback(async () => {
    if (!currentProject?.id) {
      toast.error('Project belum dipilih');
      return;
    }

    if (!scenes.length) {
      toast.error('Tidak ada scene');
      return;
    }

    setGeneratingAll(true);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (const scene of scenes) {
        setGeneratingSceneId(scene.scene_id);

        updateScene(scene.scene_id, {
          background_status: 'running',
          background_error_message: null,
          error_message: null,
        });

        try {
          const res = await fetch(
            `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/background`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            }
          );

          const data = await res.json();

          if (!res.ok || !data.ok) {
            throw new Error(data.error || data.message || 'Background generation failed');
          }

          updateScene(scene.scene_id, {
            background_status: 'completed',
            background_path: data.background_path,
            background_error_message: null,
            image_status: 'pending',
            image_path: null,
            error_message: null,
          });

          successCount++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown background error';

          updateScene(scene.scene_id, {
            background_status: 'failed',
            background_error_message: message,
            error_message: message,
          });

          failedCount++;
          console.error('[generate all backgrounds failed]', {
            sceneId: scene.scene_id,
            message,
          });
        }
      }

      if (failedCount > 0) {
        toast.error(`Background selesai: ${successCount} sukses, ${failedCount} gagal`);
      } else {
        toast.success(`Semua background selesai: ${successCount} scene`);
      }
    } finally {
      setGeneratingSceneId(null);
      setGeneratingAll(false);
    }
  }, [currentProject, scenes, updateScene]);

  return (
    <div className="p-3 space-y-3">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2">
        <Button
          variant="default"
          size="sm"
          className="w-full h-8 text-xs gap-1"
          disabled={generatingAll || Boolean(generatingSceneId)}
          onClick={handleGenerateAllBackgrounds}
        >
          {generatingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Generate All Backgrounds
        </Button>
      </div>
      {scenes.map((scene) => {
        const isSelected = scene.scene_id === selectedSceneId;
        const isGenerating = generatingSceneId === scene.scene_id || scene.background_status === 'running';

        return (
          <div
            key={scene.scene_id}
            className={`rounded-xl border p-3 space-y-2.5 transition-all cursor-pointer ${
              isSelected
                ? 'border-emerald-300 bg-emerald-50/50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/20'
                : 'border-border bg-card hover:border-emerald-200 dark:hover:border-emerald-800'
            }`}
            onClick={() => selectScene(scene.scene_id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-emerald-500 font-semibold">
                  {scene.scene_id}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  Background
                </p>
              </div>

              <SceneStatusBadge
                status={scene.background_status || 'pending'}
                label={`BG: ${getStatusLabel(scene.background_status || 'pending')}`}
              />
            </div>

            <div className="rounded-lg overflow-hidden border bg-muted/30 min-h-[160px] flex items-center justify-center">
              {scene.background_path ? (
                <img
                  src={scene.background_path}
                  alt={`${scene.scene_id} background`}
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Belum ada background</p>
                </div>
              )}
            </div>

            {isSelected && (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Background Prompt
                  </p>
                  <Textarea
                    value={scene.background_prompt || ''}
                    onChange={(e) => handleFieldChange(scene.scene_id, 'background_prompt', e.target.value)}
                    className="min-h-[80px] text-xs resize-y"
                    placeholder="Environment only, empty 2D background..."
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Background Negative
                  </p>
                  <Textarea
                    value={scene.background_negative_prompt || ''}
                    onChange={(e) => handleFieldChange(scene.scene_id, 'background_negative_prompt', e.target.value)}
                    className="min-h-[56px] text-xs resize-y"
                    placeholder="people, face, silhouette, blurry person..."
                  />
                </div>
              </>
            )}

            {scene.background_error_message && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-500">
                {scene.background_error_message}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1"
              disabled={isGenerating || generatingAll}
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateBackground(scene);
              }}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {scene.background_path ? 'Regenerate Background' : 'Generate Background'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
