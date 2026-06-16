'use client';

import { useCallback } from 'react';
import { MoreHorizontal, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useStoryboardStore, SceneData } from '@/lib/store/storyboard-store';
import { SceneStatusBadge } from './SceneStatusBadge';
import { toast } from 'sonner';

function getStatusLabel(status: string, type: 'img' | 'vid'): string {
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

export function StorylineColumn() {
  const { scenes, selectedSceneId, selectScene, updateScene, currentProject } = useStoryboardStore();

  const handleFieldChange = useCallback(
    (sceneId: string, field: keyof SceneData, value: string | number | boolean) => {
      updateScene(sceneId, { [field]: value });
    },
    [updateScene]
  );

  const handleToggleLock = useCallback(
    async (sceneId: string, currentLocked: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      updateScene(sceneId, { locked: !currentLocked });
      if (currentProject) {
        try {
          await fetch(`/api/storyboard/${currentProject.id}/scenes/${sceneId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locked: !currentLocked }),
          });
        } catch {}
      }
    },
    [updateScene, currentProject]
  );

  return (
    <div className="p-3 space-y-0">
      {scenes.map((scene, index) => {
        const isSelected = scene.scene_id === selectedSceneId;

        return (
          <div
            key={scene.scene_id}
            className={`relative pl-10 pb-6 ${index < scenes.length - 1 ? '' : ''}`}
            onClick={() => selectScene(scene.scene_id)}
          >
            {/* Timeline dot & line */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                  isSelected
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                }`}
              >
                {String(scene.scene_number).padStart(2, '0')}
              </div>
              {index < scenes.length - 1 && (
                <div className="w-px flex-1 bg-violet-200 dark:bg-violet-800/50 mt-1" />
              )}
            </div>

            {/* Card */}
            <div
              className={`rounded-xl border p-3 space-y-2.5 transition-all cursor-pointer ${
                isSelected
                  ? 'border-violet-300 bg-violet-50/50 shadow-sm dark:border-violet-700 dark:bg-violet-950/20'
                  : 'border-border bg-card hover:border-violet-200 dark:hover:border-violet-800'
              } ${scene.locked ? 'opacity-75' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Judul Scene
                  </p>
                  <p className="text-sm font-semibold truncate">
                    {scene.vo.length > 40 ? scene.vo.slice(0, 40) + '...' : scene.vo}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => handleToggleLock(scene.scene_id, scene.locked, e)}
                >
                  {scene.locked ? (
                    <Lock className="h-3 w-3 text-amber-500" />
                  ) : (
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Deskripsi / VO */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  VO / Narasi
                </p>
                <Textarea
                  value={scene.vo}
                  onChange={(e) => handleFieldChange(scene.scene_id, 'vo', e.target.value)}
                  className="min-h-[48px] text-xs resize-none"
                  style={{ fieldSizing: 'fixed' }}
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Status
                </p>
                <div className="flex items-center gap-1.5">
                  <SceneStatusBadge
                    status={scene.image_status}
                    label={`IMG: ${getStatusLabel(scene.image_status, 'img')}`}
                  />
                  <SceneStatusBadge
                    status={scene.video_status}
                    label={`VID: ${getStatusLabel(scene.video_status, 'vid')}`}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Durasi: {scene.duration}s</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
