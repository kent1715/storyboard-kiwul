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
  Clapperboard,
  FolderOpen,
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
import { Input } from '@/components/ui/input';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { JobProgress as JobProgressComponent } from './JobProgress';
import { toast } from 'sonner';

export function TopToolbar() {
  const {
    currentProject,
    scenes,
    activeJob,
    setLoadJsonDialogOpen,
    setProviderSettingsDialogOpen,
    setActiveJob,
    loadProject,
  } = useStoryboardStore();

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const isJobRunning = activeJob?.status === 'running' || activeJob?.status === 'queued';

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      // Refresh project data from server
      const res = await fetch(`/api/storyboard/${currentProject.id}`);
      const data = await res.json();
      if (data.ok) {
        toast.success('Project data refreshed');
      } else {
        toast.error('Failed to save project');
      }
    } catch {
      toast.error('Failed to save project');
    } finally {
      setSaving(false);
    }
  }, [currentProject]);

  const handleExport = useCallback(async () => {
    if (!currentProject) return;
    setExporting(true);
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
        toast.success('JSON exported');
      } else {
        toast.error(data.error || 'Export failed');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
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
        // Set the active job so polling starts
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
        toast.success(`Generation job started (${mode})`);
      } else {
        toast.error(data.error || 'Failed to start generation');
      }
    } catch {
      toast.error('Failed to start generation');
    } finally {
      setGenerating(null);
    }
  }, [currentProject, setActiveJob]);

  const handleJobControl = useCallback(async (action: 'pause' | 'resume' | 'stop') => {
    if (!activeJob) return;
    try {
      const res = await fetch(`/api/storyboard/jobs/${activeJob.job_id}/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Job ${action} successful`);
        // Update job status locally
        setActiveJob({
          ...activeJob,
          status: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'stopped',
        });
      } else {
        toast.error(data.error || `Failed to ${action} job`);
      }
    } catch {
      toast.error(`Failed to ${action} job`);
    }
  }, [activeJob, setActiveJob]);

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
        toast.error(data.error || 'Download failed');
      }
    } catch {
      toast.error('Download failed');
    }
  }, [currentProject]);

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
        toast.success('Aspect ratio updated');
      }
    } catch {
      toast.error('Failed to update aspect ratio');
    }
  }, [currentProject, loadProject]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Clapperboard className="h-6 w-6 text-emerald-600 shrink-0" />
          <span className="font-bold text-sm hidden sm:inline whitespace-nowrap">
            Kiwul Studio
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {currentProject ? (
          <>
            {/* Project Title */}
            <Input
              className="h-8 w-40 lg:w-56 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent"
              value={currentProject.title}
              onChange={() => {}}
              placeholder="Project title"
              readOnly
            />

            {/* Aspect Ratio */}
            <Select
              value={currentProject.aspect_ratio}
              onValueChange={handleAspectRatioChange}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Action Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setLoadJsonDialogOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Load</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">Save</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">Export</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setProviderSettingsDialogOpen(true)}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Providers</span>
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Generate Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                onClick={() => handleGenerate('image')}
                disabled={isJobRunning || !!generating}
              >
                {generating === 'image' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">Images</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                onClick={() => handleGenerate('video')}
                disabled={isJobRunning || !!generating}
              >
                {generating === 'video' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">Videos</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                onClick={() => handleGenerate('image_and_video')}
                disabled={isJobRunning || !!generating}
              >
                {generating === 'image_and_video' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">All</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => handleGenerate('failed_only')}
                disabled={isJobRunning || !!generating}
              >
                {generating === 'failed_only' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span className="hidden xl:inline">Failed</span>
              </Button>
            </div>

            {/* Job Controls */}
            {isJobRunning && (
              <>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-amber-600"
                    onClick={() => handleJobControl(activeJob?.status === 'paused' ? 'resume' : 'pause')}
                  >
                    {activeJob?.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    <span className="hidden md:inline">{activeJob?.status === 'paused' ? 'Resume' : 'Pause'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-red-600"
                    onClick={() => handleJobControl('stop')}
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Stop</span>
                  </Button>
                </div>
              </>
            )}

            {/* Download ZIP */}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => handleDownloadZip('project')}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden md:inline">ZIP</span>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              onClick={() => setLoadJsonDialogOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Load JSON
            </Button>
            <span className="text-sm text-muted-foreground">No project loaded</span>
          </div>
        )}
      </div>

      {/* Job Progress Bar */}
      {activeJob && <JobProgressComponent />}
    </header>
  );
}
