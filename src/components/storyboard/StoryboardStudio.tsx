'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Clapperboard,
  Moon,
  Sun,
  Sparkles,
  Save,
  Eye,
  Pencil,
  MoreHorizontal,
  FileText,
  ImageIcon,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { TopToolbar } from './TopToolbar';
import { StorylineColumn } from './StorylineColumn';
import { GambarColumn } from './GambarColumn';
import { VideoColumn } from './VideoColumn';
import { LoadJsonDialog } from './LoadJsonDialog';
import { ProviderSettingsDialog } from './ProviderSettingsDialog';
import { ProjectListDialog } from './ProjectListDialog';
import { toast } from 'sonner';

export function StoryboardStudio() {
  const { currentProject, setLoadJsonDialogOpen, setProjectListDialogOpen } = useStoryboardStore();
  const { theme, setTheme } = useTheme();
  const [mobileTab, setMobileTab] = useState<'storyline' | 'gambar' | 'video'>('storyline');

  const handleGenerateAll = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/storyboard/${currentProject.id}/generate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'image_and_video',
          skip_locked: true,
          failed_only: false,
          concurrency: { image: 1, video: 1 },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        useStoryboardStore.getState().setActiveJob({
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
        toast.success('Generate All dimulai');
      } else {
        toast.error(data.error || 'Gagal memulai generate');
      }
    } catch {
      toast.error('Gagal memulai generate');
    }
  }, [currentProject]);

  const handleSave = useCallback(async () => {
    if (!currentProject) return;
    try {
      const scenes = useStoryboardStore.getState().scenes;
      const sceneUpdates = scenes.map((s) => ({
        scene_id: s.scene_id,
        vo: s.vo,
        image_prompt: s.image_prompt,
        video_prompt: s.video_prompt,
        negative_prompt: s.negative_prompt,
        locked: s.locked,
        duration: s.duration,
        image_status: s.image_status,
        video_status: s.video_status,
      }));

      const res = await fetch(`/api/storyboard/${currentProject.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: {
            title: currentProject.title,
            aspect_ratio: currentProject.aspect_ratio,
            resolution: currentProject.resolution,
            style: currentProject.style,
            status: currentProject.status,
          },
          scenes: sceneUpdates,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Project tersimpan (${data.updated_scenes} scene diperbarui)`);
      } else {
        toast.error(data.error || 'Gagal menyimpan');
      }
    } catch {
      toast.error('Gagal menyimpan');
    }
  }, [currentProject]);

  // Empty state - no project loaded
  if (!currentProject) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <LoadJsonDialog />
        <ProviderSettingsDialog />
        <ProjectListDialog />

        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-md px-4"
          >
            <Clapperboard className="h-20 w-20 mx-auto text-emerald-500/30 mb-6" />
            <h1 className="text-2xl font-bold mb-2">Kiwul Storyboard Studio</h1>
            <p className="text-muted-foreground mb-6">
              Create, manage, and generate AI-powered storyboard content. Load a JSON file to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={() => setLoadJsonDialogOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Load Storyboard JSON
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => setProjectListDialogOpen(true)}
              >
                <FileText className="h-4 w-4" />
                Buka Project
              </Button>
            </div>

            <div className="mt-8 text-xs text-muted-foreground space-y-1">
              <p>Supported formats: JSON with project and scenes</p>
              <p>Required fields: project.title, scenes[].scene_id, vo, image_prompt, video_prompt, duration</p>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between mt-auto">
          <span>Kiwul Storyboard Studio v1.0</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
        </footer>
      </div>
    );
  }

  // Project loaded - 3 column card layout
  return (
    <div className="flex flex-col h-screen bg-background">
      <LoadJsonDialog />
      <ProviderSettingsDialog />
      <ProjectListDialog />

      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-emerald-600" />
              <h1 className="font-bold text-sm">Kiwul Studio</h1>
            </div>
            <div className="h-4 w-px bg-border" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{currentProject.title}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Waktu Pembuatan: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}, {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleGenerateAll}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate All
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Simpan
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Column Headers - Desktop */}
        <div className="hidden md:grid grid-cols-3 border-t">
          <div className="flex items-center gap-2 px-4 py-2 border-r">
            <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Storyline</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-r">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Gambar</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Video</span>
          </div>
        </div>

        {/* Mobile Tab Selector */}
        <div className="flex md:hidden border-t">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${mobileTab === 'storyline' ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/20 dark:border-violet-400' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('storyline')}
          >
            <FileText className="h-3.5 w-3.5" />
            Storyline
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${mobileTab === 'gambar' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-400' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('gambar')}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Gambar
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${mobileTab === 'video' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-400' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('video')}
          >
            <Film className="h-3.5 w-3.5" />
            Video
          </button>
        </div>

        <TopToolbar />
      </header>

      {/* 3-Column Content - Desktop */}
      <div className="hidden md:grid flex-1 min-h-0 grid-cols-3 divide-x divide-border overflow-hidden">
        <div className="overflow-y-auto custom-scrollbar">
          <StorylineColumn />
        </div>
        <div className="overflow-y-auto custom-scrollbar">
          <GambarColumn />
        </div>
        <div className="overflow-y-auto custom-scrollbar">
          <VideoColumn />
        </div>
      </div>

      {/* Mobile Single-Column Content */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {mobileTab === 'storyline' && <StorylineColumn />}
        {mobileTab === 'gambar' && <GambarColumn />}
        {mobileTab === 'video' && <VideoColumn />}
      </div>

      {/* Footer */}
      <footer className="border-t px-4 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span>{currentProject.title}</span>
          <span>&middot;</span>
          <span>{useStoryboardStore.getState().scenes.length} scenes</span>
          <span>&middot;</span>
          <span>{currentProject.aspect_ratio}</span>
          <span>&middot;</span>
          <span>{currentProject.resolution}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}
