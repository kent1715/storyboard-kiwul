// Shared types for Kiwul Storyboard Studio

export interface StoryboardJSON {
  project: {
    title: string;
    language?: string;
    aspect_ratio?: "9:16" | "16:9";
    resolution?: string;
    duration_seconds?: number;
    style?: string;
    target_platform?: string;
  };
  scenes: SceneInput[];
}

export interface SceneInput {
  scene_id: string;
  scene_number?: number;
  duration: number;
  vo: string;
  image_prompt: string;
  video_prompt: string;
  negative_prompt?: string;
  camera_prompt?: string;
  motion_prompt?: string;
  style_prompt?: string;
  seed?: number;
  locked?: boolean;
  image_status?: string;
  video_status?: string;
  image_path?: string | null;
  video_path?: string | null;
  audio_path?: string | null;
  error_message?: string | null;
}

export type SceneStatus = "pending" | "queued" | "running" | "completed" | "failed" | "skipped";
export type JobStatus = "queued" | "running" | "paused" | "stopped" | "completed" | "failed";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type GenerateMode = "image" | "video" | "image_and_video" | "failed_only";

export interface GenerateAllRequest {
  mode: GenerateMode;
  skip_locked: boolean;
  failed_only: boolean;
  concurrency: {
    image: number;
    video: number;
  };
}

export interface JobProgress {
  job_id: string;
  status: JobStatus;
  progress: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    queued_tasks: number;
    running_tasks: number;
  };
  updated_scenes: Array<{
    scene_id: string;
    image_status: string;
    video_status: string;
    image_path: string | null;
    video_path: string | null;
    error_message?: string | null;
  }>;
}

export interface ProviderConfig {
  name: string;
  type: "image" | "video";
  provider: string;
  base_url: string;
  endpoint?: string;
  model: string;
  api_key?: string;
  timeout_seconds: number;
  is_default: boolean;
  is_active: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const ASPECT_RATIOS = {
  "9:16": {
    label: "9:16 (Portrait)",
    resolutions: ["480x832", "720x1280", "1080x1920"],
    default: "1080x1920",
    lightDefault: "480x832",
  },
  "16:9": {
    label: "16:9 (Landscape)",
    resolutions: ["832x480", "1280x720", "1920x1080"],
    default: "1920x1080",
    lightDefault: "832x480",
  },
} as const;

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 border-gray-300",
  queued: "bg-blue-50 text-blue-700 border-blue-300",
  running: "bg-yellow-50 text-yellow-700 border-yellow-300",
  completed: "bg-green-50 text-green-700 border-green-300",
  failed: "bg-red-50 text-red-700 border-red-300",
  skipped: "bg-gray-50 text-gray-500 border-gray-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};
