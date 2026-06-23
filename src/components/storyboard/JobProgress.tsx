'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { useStoryboardStore } from '@/lib/store/storyboard-store';

export function JobProgress() {
  const {
    currentProject,
    activeJob,
    setActiveJob,
    updateSceneFromJob,
    isPolling,
    setIsPolling,
    setScenes,
  } = useStoryboardStore();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollJobStatus = useCallback(async () => {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/storyboard/jobs/${activeJob.job_id}`);
      const data = await res.json();
      if (data.ok && data.job_id) {
        const job = {
          job_id: data.job_id,
          status: data.status,
          progress: data.progress,
          updated_scenes: data.updated_scenes || [],
        };
        setActiveJob(job);

        // Update scenes from job
        if (job.updated_scenes && job.updated_scenes.length > 0) {
          updateSceneFromJob(job.updated_scenes);
        }

        // Force refresh scenes from database so completed videos/images appear in UI
        if (currentProject?.id) {
          try {
            const sceneRes = await fetch(`/api/storyboard/${currentProject.id}/scenes`, {
              cache: 'no-store',
            });
            const sceneData = await sceneRes.json();
            if (sceneData.ok && Array.isArray(sceneData.scenes)) {
              setScenes(sceneData.scenes);
            }
          } catch {
            // Silently fail scene refresh
          }
        }

        // Stop polling if job is done
        if (['completed', 'stopped', 'failed'].includes(job.status)) {
          setIsPolling(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch {
      // Silently fail polling
    }
  }, [activeJob, currentProject?.id, setActiveJob, updateSceneFromJob, setIsPolling, setScenes]);

  // Start/stop polling
  useEffect(() => {
    if (isPolling && activeJob && !pollingRef.current) {
      pollingRef.current = setInterval(pollJobStatus, 3000);
    }
    if (!isPolling && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isPolling, activeJob, pollJobStatus]);

  // Start polling when job starts
  useEffect(() => {
    if (activeJob && ['running', 'queued'].includes(activeJob.status) && !isPolling) {
      setIsPolling(true);
    }
  }, [activeJob, isPolling, setIsPolling]);

  if (!activeJob) return null;

  const { progress, status } = activeJob;
  const totalTasks = progress.total_tasks || 0;
  const completedTasks = progress.completed_tasks || 0;
  const failedTasks = progress.failed_tasks || 0;
  const runningTasks = progress.running_tasks || 0;
  const queuedTasks = progress.queued_tasks || 0;

  const percent = totalTasks > 0 ? Math.round(((completedTasks + failedTasks) / totalTasks) * 100) : 0;

  const statusLabel: Record<string, string> = {
    queued: 'Queued',
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
    completed: 'Completed',
    failed: 'Failed',
  };

  const statusColor: Record<string, string> = {
    queued: 'text-blue-600',
    running: 'text-amber-600',
    paused: 'text-amber-600',
    stopped: 'text-red-600',
    completed: 'text-emerald-600',
    failed: 'text-red-600',
  };

  return (
    <div className="border-t bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">Job:</span>
          <span className={statusColor[status] || 'text-muted-foreground'}>
            {statusLabel[status] || status}
          </span>
        </div>

        <div className="flex-1 max-w-xs">
          <Progress value={percent} className="h-2" />
        </div>

        <div className="text-xs text-muted-foreground">
          {percent}% ({completedTasks}/{totalTasks})
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-emerald-600">{completedTasks} done</span>
          <span className="text-red-600">{failedTasks} fail</span>
          <span className="text-amber-600">{runningTasks} running</span>
          <span className="text-gray-500">{queuedTasks} queued</span>
        </div>
      </div>
    </div>
  );
}
