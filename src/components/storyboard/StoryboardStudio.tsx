'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Upload, Clapperboard, Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { TopToolbar } from './TopToolbar';
import { SceneSidebar } from './SceneSidebar';
import { SceneDetailPanel } from './SceneDetailPanel';
import { PreviewPanel } from './PreviewPanel';
import { LoadJsonDialog } from './LoadJsonDialog';
import { ProviderSettingsDialog } from './ProviderSettingsDialog';

export function StoryboardStudio() {
  const { currentProject, setLoadJsonDialogOpen } = useStoryboardStore();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  // Empty state - no project loaded
  if (!currentProject) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <TopToolbar />
        <LoadJsonDialog />
        <ProviderSettingsDialog />

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
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => setLoadJsonDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Load Storyboard JSON
            </Button>

            <div className="mt-8 text-xs text-muted-foreground space-y-1">
              <p>Supported formats: JSON with project and scenes</p>
              <p>Required fields: project.title, scenes[].scene_id, vo, image_prompt, video_prompt, duration</p>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
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

  // Project loaded - show the main layout
  return (
    <div className="flex flex-col h-screen bg-background">
      <TopToolbar />
      <LoadJsonDialog />
      <ProviderSettingsDialog />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar - Scene List */}
          {!sidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
                <SceneSidebar />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Center Panel - Scene Detail */}
          <ResizablePanel defaultSize={previewCollapsed ? 82 : 45} minSize={30}>
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 left-2 z-10 h-7 w-7 p-0"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              </Button>
              <SceneDetailPanel />
            </div>
          </ResizablePanel>

          {/* Right Panel - Preview */}
          {!previewCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={37} minSize={20} maxSize={55}>
                <PreviewPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
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
