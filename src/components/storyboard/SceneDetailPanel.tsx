'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Lock,
  Unlock,
  ImageIcon,
  Video,
  RotateCcw,
  Copy,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStoryboardStore, SceneData } from '@/lib/store/storyboard-store';
import { SceneCharacterSelector } from './SceneCharacterSelector';
import { StatusBadge } from './StatusBadge';
import { toast } from 'sonner';

export function SceneDetailPanel() {
  const { scenes, selectedSceneId, updateScene, currentProject } = useStoryboardStore();
  const scene = scenes.find(s => s.scene_id === selectedSceneId) || null;

  const [generating, setGenerating] = useState<'image' | 'video' | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFieldChange = useCallback(
    (field: keyof SceneData, value: string | number | boolean) => {
      if (!scene) return;
      updateScene(scene.scene_id, { [field]: value });
    },
    [scene, updateScene]
  );

  const handleBlur = useCallback(
    (field: keyof SceneData, value: string | number | boolean) => {
      if (!scene || !currentProject) return;
      // Debounced save to API
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
          });
        } catch {
          // Silently fail for auto-save
        }
      }, 500);
    },
    [scene, currentProject]
  );

  const handleToggleLock = useCallback(async () => {
    if (!scene || !currentProject) return;
    const newLocked = !scene.locked;
    updateScene(scene.scene_id, { locked: newLocked });
    try {
      await fetch(`/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: newLocked }),
      });
    } catch {
      // Silently fail
    }
  }, [scene, currentProject, updateScene]);

  const handleGenerateSingle = useCallback(
    async (type: 'image' | 'video') => {
      if (!scene || !currentProject) return;
      setGenerating(type);
      try {
        // Update status to running locally
        updateScene(scene.scene_id, {
          [type === 'image' ? 'image_status' : 'video_status']: 'running',
          error_message: null,
        });

        const res = await fetch(
          `/api/storyboard/${currentProject.id}/scenes/${scene.scene_id}/${type}`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (data.ok) {
          // Update with the result
          updateScene(scene.scene_id, {
            [type === 'image' ? 'image_status' : 'video_status']: 'completed',
            [type === 'image' ? 'image_path' : 'video_path']: data[type === 'image' ? 'image_path' : 'video_path'],
            error_message: null,
          });
          toast.success(`${type === 'image' ? 'Image' : 'Video'} generated successfully`);
        } else {
          updateScene(scene.scene_id, {
            [type === 'image' ? 'image_status' : 'video_status']: 'failed',
            error_message: data.error || `Failed to generate ${type}`,
          });
          toast.error(data.error || `Failed to generate ${type}`);
        }
      } catch (err) {
        updateScene(scene.scene_id, {
          [type === 'image' ? 'image_status' : 'video_status']: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
        toast.error(`Failed to generate ${type}`);
      } finally {
        setGenerating(null);
      }
    },
    [scene, currentProject, updateScene]
  );

  const handleRetry = useCallback(async () => {
    if (!scene || !currentProject) return;
    updateScene(scene.scene_id, {
      image_status: scene.image_status === 'failed' ? 'pending' : scene.image_status,
      video_status: scene.video_status === 'failed' ? 'pending' : scene.video_status,
      error_message: null,
    });
    toast.success('Status reset. You can now retry generation.');
  }, [scene, currentProject, updateScene]);

  const handleCopyError = useCallback(() => {
    if (scene?.error_message) {
      navigator.clipboard.writeText(scene.error_message);
      toast.success('Error copied to clipboard');
    }
  }, [scene]);

  const handleResetStatus = useCallback(() => {
    if (!scene) return;
    updateScene(scene.scene_id, {
      image_status: 'pending',
      video_status: 'pending',
      error_message: null,
    });
    toast.success('Status reset to pending');
  }, [scene, updateScene]);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a scene from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full overflow-hidden">
      <div className="p-4 space-y-4 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Scene #{scene.scene_number}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              {scene.scene_id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={scene.image_status} label={`IMG: ${scene.image_status}`} />
            <StatusBadge status={scene.video_status} label={`VID: ${scene.video_status}`} />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleToggleLock}
            >
              {scene.locked ? (
                <Lock className="h-4 w-4 text-amber-500" />
              ) : (
                <Unlock className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Error Display */}
        {scene.error_message && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Error</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5 break-words">
                  {scene.error_message}
                </p>
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Retry
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={handleCopyError}
                  >
                    <Copy className="h-2.5 w-2.5" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={handleResetStatus}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Duration (seconds)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={scene.duration}
            onChange={(e) => handleFieldChange('duration', parseInt(e.target.value) || 1)}
            onBlur={(e) => handleBlur('duration', parseInt(e.target.value) || 1)}
            className="h-8 text-sm w-24"
          />
        </div>

        {/* Scene Character Reference */}
        {currentProject?.id && scene?.scene_id && (
          <SceneCharacterSelector
            projectId={currentProject.id}
            sceneId={scene.scene_id}
          />
        )}

        {/* VO */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Voice Over (VO)</Label>
          <Textarea
            value={scene.vo}
            onChange={(e) => handleFieldChange('vo', e.target.value)}
            onBlur={(e) => handleBlur('vo', e.target.value)}
            className="min-h-[80px] text-sm resize-y"
            placeholder="Voice over text..."
          />
        </div>

        {/* Background Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Background Prompt</Label>
          <Textarea
            value={scene.background_prompt || ''}
            onChange={(e) => handleFieldChange('background_prompt', e.target.value)}
            onBlur={(e) => handleBlur('background_prompt', e.target.value)}
            className="min-h-[80px] text-sm resize-y"
            placeholder="Background/environment only prompt..."
          />
        </div>

        {/* Background Negative Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Background Negative Prompt</Label>
          <Textarea
            value={scene.background_negative_prompt || ''}
            onChange={(e) => handleFieldChange('background_negative_prompt', e.target.value)}
            onBlur={(e) => handleBlur('background_negative_prompt', e.target.value)}
            className="min-h-[60px] text-sm resize-y"
            placeholder="Background negative prompt, e.g. people, face, silhouette..."
          />
        </div>

        {/* Image Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Image Prompt</Label>
          <Textarea
            value={scene.image_prompt}
            onChange={(e) => handleFieldChange('image_prompt', e.target.value)}
            onBlur={(e) => handleBlur('image_prompt', e.target.value)}
            className="min-h-[80px] text-sm resize-y"
            placeholder="Image generation prompt..."
          />
        </div>

        {/* Video Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Video Prompt</Label>
          <Textarea
            value={scene.video_prompt}
            onChange={(e) => handleFieldChange('video_prompt', e.target.value)}
            onBlur={(e) => handleBlur('video_prompt', e.target.value)}
            className="min-h-[80px] text-sm resize-y"
            placeholder="Video generation prompt..."
          />
        </div>

        {/* Negative Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Negative Prompt</Label>
          <Textarea
            value={scene.negative_prompt || ''}
            onChange={(e) => handleFieldChange('negative_prompt', e.target.value)}
            onBlur={(e) => handleBlur('negative_prompt', e.target.value)}
            className="min-h-[60px] text-sm resize-y"
            placeholder="Negative prompt (optional)..."
          />
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
            onClick={() => handleGenerateSingle('image')}
            disabled={generating === 'image' || scene.locked}
          >
            {generating === 'image' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            Generate Image
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
            onClick={() => handleGenerateSingle('video')}
            disabled={generating === 'video' || scene.locked || scene.image_status !== 'completed'}
          >
            {generating === 'video' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
            Generate Video
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleResetStatus}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Status
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
