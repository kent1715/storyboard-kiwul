'use client';

import { create } from 'zustand';
import { SceneInput, JobProgress, ProviderConfig } from '@/types/storyboard';

export interface ProjectData {
  id: string;
  title: string;
  language: string;
  aspect_ratio: string;
  resolution: string;
  duration_seconds: number | null;
  style: string | null;
  target_platform: string | null;
  status: string;
  json_path: string | null;
}

export interface SceneData extends SceneInput {
  id: string;
  project_id: string;
  scene_number: number;
  // Override optional fields from SceneInput with DB types
  negative_prompt: string | null;
  image_path: string | null;
  video_path: string | null;
  audio_path: string | null;
  error_message: string | null;
  locked: boolean;
  image_status: string;
  video_status: string;
}

interface StoryboardState {
  // Project
  currentProject: ProjectData | null;
  scenes: SceneData[];
  selectedSceneId: string | null;

  // Job
  activeJob: JobProgress | null;
  isPolling: boolean;

  // Dialogs
  loadJsonDialogOpen: boolean;
  providerSettingsDialogOpen: boolean;

  // Providers
  providers: ProviderConfig[];
  providersLoading: boolean;

  // Computed
  selectedScene: SceneData | null;

  // Actions
  loadProject: (project: ProjectData, scenes: SceneData[]) => void;
  clearProject: () => void;
  selectScene: (sceneId: string | null) => void;
  updateScene: (sceneId: string, updates: Partial<SceneData>) => void;
  setScenes: (scenes: SceneData[]) => void;
  setActiveJob: (job: JobProgress | null) => void;
  setIsPolling: (polling: boolean) => void;
  setLoadJsonDialogOpen: (open: boolean) => void;
  setProviderSettingsDialogOpen: (open: boolean) => void;
  setProviders: (providers: ProviderConfig[]) => void;
  setProvidersLoading: (loading: boolean) => void;
  updateSceneFromJob: (updatedScenes: JobProgress['updated_scenes']) => void;
}

export const useStoryboardStore = create<StoryboardState>((set, get) => ({
  // Initial state
  currentProject: null,
  scenes: [],
  selectedSceneId: null,
  activeJob: null,
  isPolling: false,
  loadJsonDialogOpen: false,
  providerSettingsDialogOpen: false,
  providers: [],
  providersLoading: false,

  // Computed
  get selectedScene() {
    const state = get();
    if (!state.selectedSceneId) return null;
    return state.scenes.find(s => s.scene_id === state.selectedSceneId) || null;
  },

  // Actions
  loadProject: (project, scenes) => set({
    currentProject: project,
    scenes,
    selectedSceneId: scenes.length > 0 ? scenes[0].scene_id : null,
    activeJob: null,
    isPolling: false,
  }),

  clearProject: () => set({
    currentProject: null,
    scenes: [],
    selectedSceneId: null,
    activeJob: null,
    isPolling: false,
  }),

  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

  updateScene: (sceneId, updates) => set(state => ({
    scenes: state.scenes.map(s =>
      s.scene_id === sceneId ? { ...s, ...updates } : s
    ),
  })),

  setScenes: (scenes) => set({ scenes }),

  setActiveJob: (job) => set({ activeJob: job }),

  setIsPolling: (polling) => set({ isPolling: polling }),

  setLoadJsonDialogOpen: (open) => set({ loadJsonDialogOpen: open }),

  setProviderSettingsDialogOpen: (open) => set({ providerSettingsDialogOpen: open }),

  setProviders: (providers) => set({ providers }),

  setProvidersLoading: (loading) => set({ providersLoading: loading }),

  updateSceneFromJob: (updatedScenes) => set(state => ({
    scenes: state.scenes.map(scene => {
      const update = updatedScenes.find(u => u.scene_id === scene.scene_id);
      if (update) {
        return {
          ...scene,
          image_status: update.image_status,
          video_status: update.video_status,
          image_path: update.image_path,
          video_path: update.video_path,
          error_message: update.error_message ?? scene.error_message,
        };
      }
      return scene;
    }),
  })),
}));
