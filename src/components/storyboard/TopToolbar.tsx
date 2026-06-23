'use client';

import { useCallback, useState } from 'react';
import {
  Upload,
  Save,
  Download,
  Settings,
  ImageIcon,
  Video,
  Play,
  Pause,
  Square,
  RotateCcw,
  Loader2,
  FolderOpen,
  FolderCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { JobProgress as JobProgressComponent } from './JobProgress';
import { toast } from 'sonner';

export function TopToolbar() {
  const {
    currentProject,
    activeJob,
    setLoadJsonDialogOpen,
    setProviderSettingsDialogOpen,
    setProjectListDialogOpen,
    setActiveJob,
    loadProject,
  } = useStoryboardStore();

  const [generating, setGenerating] = useState<string | null>(null);

  const isJobRunning = activeJob?.status === 'running' || activeJob?.status === 'queued';

  const handleExport = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/export`);
      const data = await res.json();
      if (data.project) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.title || 'storyboard'}_final.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('JSON diekspor');
      } else {
        toast.error(data.error || 'Ekspor gagal');
      }
    } catch {
      toast.error('Ekspor gagal');
    }
  }, [currentProject]);

  const handleGenerate = useCallback(async (mode: string) => {
    if (!currentProject) return;
    setGenerating(mode);
    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/generate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          skip_locked: true,
          failed_only: mode === 'failed_only',
          concurrency: { image: 1, video: 1 },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveJob({
          job_id: data.job_id,
          status: 'running',
          progress: {
            total_tasks: data.total_tasks || 0,
            completed_tasks: 0,
            failed_tasks: 0,
            queued_tasks: data.total_tasks || 0,
            running_tasks: 0,
          },
          updated_scenes: [],
        });
        toast.success(`Generate dimulai (${mode})`);
      } else {
        toast.error(data.error || 'Gagal memulai generate');
      }
    } catch {
      toast.error('Gagal memulai generate');
    } finally {
      setGenerating(null);
    }
  }, [currentProject, setActiveJob]);

  const handleRenderFinalVideo = async () => {
    if (!currentProject?.id) return

    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/render`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!data.ok) {
        alert(data.error || 'Render final video failed')
        console.error('[render final video]', data)
        return
      }

      alert('Final video berhasil dirender.')
    } catch (error) {
      console.error('[render final video]', error)
      alert('Render final video gagal.')
    }
  };

  const handleDownloadFinalVideo = () => {
    if (!currentProject?.id) return
    window.open(`/api/storyboard/${currentProject.id}/download/final?v=${Date.now()}`, '_blank')
  };

  const handleJobControl = useCallback(async (action: 'pause' | 'resume' | 'stop') => {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/storyboard/jobs/${activeJob.job_id}/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Job ${action} berhasil`);
        setActiveJob({
          ...activeJob,
          status: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'stopped',
        });
      } else {
        toast.error(data.error || `Gagal ${action} job`);
      }
    } catch {
      toast.error(`Gagal ${action} job`);
    }
  }, [activeJob, setActiveJob]);

  const handleAspectRatioChange = useCallback(async (value: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect_ratio: value }),
      });
      const data = await res.json();
      if (data.ok) {
        loadProject(
          { ...currentProject, aspect_ratio: value },
          useStoryboardStore.getState().scenes
        );
        toast.success('Aspect ratio diperbarui');
      }
    } catch {
      toast.error('Gagal mengubah aspect ratio');
    }
  }, [currentProject, loadProject]);

  const handleDownloadZip = useCallback(async (type: 'images' | 'videos' | 'project') => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/download?type=${type}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.title || 'storyboard'}_${type}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Unduhan gagal');
      }
    } catch {
      toast.error('Unduhan gagal');
    }
  }, [currentProject]);

  if (!currentProject) return null;

  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] overflow-x-auto">
        {/* Aspect Ratio */}
        <Select
          value={currentProject.aspect_ratio}
          onValueChange={handleAspectRatioChange}
        >
          <SelectTrigger className="h-6 w-20 text-[10px] border-0 bg-muted/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="16:9">16:9</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Generate Buttons */}

        <Button
          onClick={handleRenderFinalVideo}
          disabled={!currentProject}
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
        >
          Render Final Video
        </Button>

        <Button
          onClick={handleDownloadFinalVideo}
          disabled={!currentProject}
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
        >
          Download Final Video
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => handleGenerate('failed_only')}
          disabled={isJobRunning || !!generating}
        >
          {generating === 'failed_only' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Generate Failed Only
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Job Controls */}
        {isJobRunning && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-1.5 text-amber-600"
              onClick={() => handleJobControl(activeJob?.status === 'paused' ? 'resume' : 'pause')}
            >
              {activeJob?.status === 'paused' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {activeJob?.status === 'paused' ? 'Lanjut' : 'Jeda'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-1.5 text-red-600"
              onClick={() => handleJobControl('stop')}
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
          </>
        )}

        {/* Utility Buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => setProjectListDialogOpen(true)}
        >
          <FolderCog className="h-3 w-3" />
          Project
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => setLoadJsonDialogOpen(true)}
        >
          <FolderOpen className="h-3 w-3" />
          Load
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={handleExport}
        >
          <Download className="h-3 w-3" />
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => handleDownloadZip('project')}
        >
          <Upload className="h-3 w-3" />
          ZIP
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => setProviderSettingsDialogOpen(true)}
        >
          <Settings className="h-3 w-3" />
          Providers
        </Button>
      </div>

      {/* Job Progress Bar */}
      {activeJob && <JobProgressComponent />}
    </>
  );
}
