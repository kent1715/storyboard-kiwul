'use client';

import { useMemo } from 'react';
import { Lock, Unlock, ImageIcon, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

export function SceneSidebar() {
  const { scenes, selectedSceneId, selectScene, updateScene } = useStoryboardStore();

  const stats = useMemo(() => {
    const imageCompleted = scenes.filter(s => s.image_status === 'completed').length;
    const imageFailed = scenes.filter(s => s.image_status === 'failed').length;
    const imagePending = scenes.filter(s => s.image_status === 'pending' || s.image_status === 'queued').length;
    const videoCompleted = scenes.filter(s => s.video_status === 'completed').length;
    const videoFailed = scenes.filter(s => s.video_status === 'failed').length;
    const videoPending = scenes.filter(s => s.video_status === 'pending' || s.video_status === 'queued').length;
    return { imageCompleted, imageFailed, imagePending, videoCompleted, videoFailed, videoPending };
  }, [scenes]);

  const handleToggleLock = (sceneId: string, currentLocked: boolean) => {
    updateScene(sceneId, { locked: !currentLocked });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Stats Header */}
      <div className="p-3 border-b shrink-0">
        <div className="text-xs font-medium text-muted-foreground mb-2">Scenes Overview</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium">
              <ImageIcon className="h-3 w-3 text-emerald-600" />
              Images
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                {stats.imageCompleted} done
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                {stats.imageFailed} fail
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700">
                {stats.imagePending} pending
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium">
              <Video className="h-3 w-3 text-emerald-600" />
              Videos
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                {stats.videoCompleted} done
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                {stats.videoFailed} fail
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700">
                {stats.videoPending} pending
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Scene List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {scenes.map((scene) => {
            const isSelected = scene.scene_id === selectedSceneId;
            const voPreview = scene.vo.length > 60 ? scene.vo.slice(0, 60) + '...' : scene.vo;

            return (
              <button
                key={scene.scene_id}
                className={cn(
                  'w-full text-left rounded-lg p-2.5 transition-all duration-150',
                  'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50',
                  isSelected
                    ? 'bg-emerald-50 border border-emerald-300 shadow-sm dark:bg-emerald-950/40 dark:border-emerald-800'
                    : 'border border-transparent',
                  scene.locked && 'opacity-75'
                )}
                onClick={() => selectScene(scene.scene_id)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        #{scene.scene_number}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {scene.scene_id}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {scene.duration}s
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                      {voPreview}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <StatusBadge status={scene.image_status} label="IMG" className="text-[9px]" />
                      <StatusBadge status={scene.video_status} label="VID" className="text-[9px]" />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLock(scene.scene_id, scene.locked);
                    }}
                  >
                    {scene.locked ? (
                      <Lock className="h-3 w-3 text-amber-500" />
                    ) : (
                      <Unlock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t shrink-0">
        <div className="text-[10px] text-muted-foreground text-center">
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''} &middot; {scenes.reduce((a, s) => a + s.duration, 0)}s total
        </div>
      </div>
    </div>
  );
}
