'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen,
  Trash2,
  Clock,
  Film,
  Loader2,
  Search,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStoryboardStore, ProjectData } from '@/lib/store/storyboard-store';
import { toast } from 'sonner';

interface ProjectListItem {
  id: string;
  title: string;
  language: string;
  aspect_ratio: string;
  resolution: string;
  duration_seconds: number | null;
  style: string | null;
  target_platform: string | null;
  status: string;
  scene_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  loaded: { label: 'Loaded', variant: 'default' },
  generating: { label: 'Generating', variant: 'default' },
  exported: { label: 'Exported', variant: 'outline' },
  completed: { label: 'Completed', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function ProjectListDialog() {
  const { projectListDialogOpen, setProjectListDialogOpen, loadProject } = useStoryboardStore();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storyboard/list');
      const data = await res.json();
      if (data.ok) {
        setProjects(data.projects);
      } else {
        toast.error('Gagal memuat daftar project');
      }
    } catch {
      toast.error('Gagal memuat daftar project');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectListDialogOpen) {
      setSearch('');
      setDeleteTarget(null);
      fetchProjects();
    }
  }, [projectListDialogOpen, fetchProjects]);

  const handleOpenProject = useCallback(async (project: ProjectListItem) => {
    setOpeningId(project.id);
    try {
      const res = await fetch(`/api/storyboard/${project.id}`);
      const data = await res.json();
      if (data.ok && data.project) {
        const proj: ProjectData = {
          id: data.project.id,
          title: data.project.title,
          language: data.project.language,
          aspect_ratio: data.project.aspect_ratio,
          resolution: data.project.resolution,
          duration_seconds: data.project.duration_seconds,
          style: data.project.style,
          target_platform: data.project.target_platform,
          status: data.project.status,
          json_path: data.project.json_path,
        };
        loadProject(proj, data.scenes || []);
        setProjectListDialogOpen(false);
        toast.success(`Project "${project.title}" dibuka`);
      } else {
        toast.error('Gagal membuka project');
      }
    } catch {
      toast.error('Gagal membuka project');
    } finally {
      setOpeningId(null);
    }
  }, [loadProject, setProjectListDialogOpen]);

  const handleDeleteProject = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/storyboard/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        toast.success(`Project "${deleteTarget.title}" dihapus`);
        // If the deleted project is the current one, clear it
        const currentProject = useStoryboardStore.getState().currentProject;
        if (currentProject?.id === deleteTarget.id) {
          useStoryboardStore.getState().clearProject();
        }
      } else {
        toast.error(data.error || 'Gagal menghapus project');
      }
    } catch {
      toast.error('Gagal menghapus project');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <>
      <Dialog open={projectListDialogOpen} onOpenChange={setProjectListDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-emerald-600" />
              Daftar Project
            </DialogTitle>
            <DialogDescription>
              Pilih project yang ingin dibuka atau kelola.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Project List */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="ml-3 text-sm text-muted-foreground">Memuat daftar project...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutGrid className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {projects.length === 0 ? 'Belum ada project tersimpan' : 'Project tidak ditemukan'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {projects.length === 0
                    ? 'Load storyboard JSON untuk membuat project baru'
                    : 'Coba kata kunci lain'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-1">
                  {filteredProjects.map((project) => {
                    const statusInfo = STATUS_MAP[project.status] || { label: project.status, variant: 'secondary' as const };
                    const isOpening = openingId === project.id;

                    return (
                      <div
                        key={project.id}
                        className="group relative border rounded-lg p-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
                        onClick={() => handleOpenProject(project)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm truncate">{project.title}</h3>
                              <Badge variant={statusInfo.variant} className="text-[10px] h-4 px-1.5 shrink-0">
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Film className="h-3 w-3" />
                                {project.scene_count} scene
                              </span>
                              {project.aspect_ratio && (
                                <span>{project.aspect_ratio}</span>
                              )}
                              {project.resolution && (
                                <span>{project.resolution}</span>
                              )}
                              {formatDuration(project.duration_seconds) && (
                                <span>{formatDuration(project.duration_seconds)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1.5">
                              <Clock className="h-3 w-3" />
                              <span>Diperbarui: {formatDate(project.updated_at)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isOpening ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(project);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Footer info */}
          <div className="shrink-0 border-t pt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectListDialogOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Hapus Project
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus project <strong>&quot;{deleteTarget?.title}&quot;</strong>?
              Semua data scene dan media terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
