'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileJson, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStoryboardStore, ProjectData } from '@/lib/store/storyboard-store';
import { ValidationResult } from '@/types/storyboard';
import { validateStoryboardJSON, parseStoryboardJSON } from '@/lib/validate-storyboard';
import { toast } from 'sonner';

export function LoadJsonDialog() {
  const { loadJsonDialogOpen, setLoadJsonDialogOpen, loadProject } = useStoryboardStore();
  const [jsonText, setJsonText] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidate = useCallback(() => {
    if (!jsonText.trim()) {
      setValidation({ valid: false, errors: ['JSON text is empty'], warnings: [] });
      return;
    }
    // Validate client-side
    const parseResult = parseStoryboardJSON(jsonText);
    if (parseResult.errors.length > 0) {
      setValidation({ valid: false, errors: parseResult.errors, warnings: [] });
      return;
    }
    const result = validateStoryboardJSON(parseResult.data);
    setValidation(result);
  }, [jsonText]);

  const handleLoad = useCallback(async () => {
    if (!validation?.valid) return;
    setLoading(true);
    try {
      // Parse the JSON
      const parsed = JSON.parse(jsonText);
      
      const res = await fetch('/api/storyboard/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: parsed }),
      });
      const data = await res.json();
      if (data.ok) {
        // Fetch full project details
        const projectRes = await fetch(`/api/storyboard/${data.project_id}`);
        const projectData = await projectRes.json();
        
        let project: ProjectData;
        let scenes = data.scenes || [];
        
        if (projectData.ok && projectData.project) {
          project = projectData.project as ProjectData;
          scenes = projectData.scenes || scenes;
        } else {
          project = {
            id: data.project_id,
            title: parsed.project?.title || 'Untitled',
            language: parsed.project?.language || 'id',
            aspect_ratio: parsed.project?.aspect_ratio || '9:16',
            resolution: parsed.project?.resolution || '1080x1920',
            duration_seconds: parsed.project?.duration_seconds || null,
            style: parsed.project?.style || null,
            target_platform: parsed.project?.target_platform || null,
            status: 'loaded',
            json_path: null,
          };
        }

        loadProject(project, scenes);
        setLoadJsonDialogOpen(false);
        setJsonText('');
        setValidation(null);
        toast.success(`Project loaded: ${scenes.length} scenes`);
      } else {
        toast.error(data.error || (data.errors && data.errors.join('; ')) || 'Failed to load project');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [validation, jsonText, loadProject, setLoadJsonDialogOpen]);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
      setValidation(null);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <Dialog open={loadJsonDialogOpen} onOpenChange={setLoadJsonDialogOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-emerald-600" />
            Load Storyboard JSON
          </DialogTitle>
          <DialogDescription>
            Upload a JSON file or paste your storyboard data to load it into the studio.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="paste">Paste JSON</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex-1 min-h-0 mt-2">
            <Textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setValidation(null);
              }}
              className="min-h-[200px] font-mono text-xs resize-y"
              placeholder='{"project": {...}, "scenes": [...]}'
            />
          </TabsContent>

          <TabsContent value="upload" className="flex-1 min-h-0 mt-2">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Drop your JSON file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Validation Results */}
        {validation && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {validation.valid && (
              <div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">JSON is valid!</span>
              </div>
            )}
            {validation.errors.length > 0 && (
              <div className="space-y-1">
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-1.5 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="text-xs">{err}</span>
                  </div>
                ))}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="space-y-1">
                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-1.5 rounded bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="text-xs">{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setLoadJsonDialogOpen(false)} size="sm">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={!jsonText.trim()}
            size="sm"
          >
            Validate
          </Button>
          <Button
            onClick={handleLoad}
            disabled={!validation?.valid || loading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? 'Loading...' : 'Load Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
