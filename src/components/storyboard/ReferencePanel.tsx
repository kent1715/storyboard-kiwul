'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/store/storyboard-store';

type ReferenceKind = 'character' | 'style' | 'location' | 'other';

type ReferenceItem = {
  id: string;
  kind: ReferenceKind | string;
  file_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
};

const kindLabels: Record<ReferenceKind, string> = {
  character: 'Character',
  style: 'Style',
  location: 'Location',
  other: 'Other',
};

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function ReferencePanel() {
  const { currentProject } = useStoryboardStore();
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<ReferenceKind | null>(null);
  const [expanded, setExpanded] = useState(false);

  const characterInputRef = useRef<HTMLInputElement | null>(null);
  const styleInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  const fetchReferences = useCallback(async () => {
    if (!currentProject?.id) {
      setReferences([]);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/storyboard/${currentProject.id}/references`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.ok) {
        setReferences(Array.isArray(data.references) ? data.references : []);
      } else {
        console.error('[references list]', data);
      }
    } catch (error) {
      console.error('[references list]', error);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  const uploadReference = async (kind: ReferenceKind, file?: File | null) => {
    if (!currentProject?.id || !file) return;

    try {
      setUploadingKind(kind);

      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);

      const res = await fetch(`/api/storyboard/${currentProject.id}/references`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Upload reference gagal');
        console.error('[reference upload]', data);
        return;
      }

      setReferences(Array.isArray(data.references) ? data.references : []);
    } catch (error) {
      console.error('[reference upload]', error);
      alert('Upload reference gagal');
    } finally {
      setUploadingKind(null);

      if (characterInputRef.current) characterInputRef.current.value = '';
      if (styleInputRef.current) styleInputRef.current.value = '';
      if (locationInputRef.current) locationInputRef.current.value = '';
    }
  };

  const deleteReference = async (item: ReferenceItem) => {
    if (!currentProject?.id) return;

    const ok = confirm(`Hapus reference "${item.original_name}"?`);
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/storyboard/${currentProject.id}/references?file=${encodeURIComponent(item.file_name)}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Hapus reference gagal');
        console.error('[reference delete]', data);
        return;
      }

      setReferences(Array.isArray(data.references) ? data.references : []);
    } catch (error) {
      console.error('[reference delete]', error);
      alert('Hapus reference gagal');
    }
  };

  if (!currentProject) {
    return null;
  }

  const characterCount = references.filter((item) => item.kind === 'character').length;
  const styleCount = references.filter((item) => item.kind === 'style').length;
  const locationCount = references.filter((item) => item.kind === 'location').length;

  if (!expanded) {
    return (
      <div className="border-b bg-background/80 px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold leading-none">Image Reference</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {characterCount} Character / {styleCount} Style / {locationCount} Location
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-1.5"
            disabled={loading}
            onClick={() => setExpanded(true)}
          >
            Manage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-background/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2">
          <div className="text-[11px] font-semibold leading-none">Image Reference</div>
          <div className="text-[10px] text-muted-foreground">
            {characterCount} Character / {styleCount} Style / {locationCount} Location
          </div>
        </div>

        <input
          ref={characterInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => uploadReference('character', event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          disabled={uploadingKind !== null}
          onClick={() => characterInputRef.current?.click()}
        >
          {uploadingKind === 'character' ? 'Uploading...' : 'Upload Character'}
        </Button>

        <input
          ref={styleInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => uploadReference('style', event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          disabled={uploadingKind !== null}
          onClick={() => styleInputRef.current?.click()}
        >
          {uploadingKind === 'style' ? 'Uploading...' : 'Upload Style'}
        </Button>

        <input
          ref={locationInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => uploadReference('location', event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          disabled={uploadingKind !== null}
          onClick={() => locationInputRef.current?.click()}
        >
          {uploadingKind === 'location' ? 'Uploading...' : 'Upload Location'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          disabled={loading}
          onClick={fetchReferences}
        >
          Refresh
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-1.5"
          onClick={() => setExpanded(false)}
        >
          Hide
        </Button>
      </div>

      {references.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {references.map((item) => {
            const kind = (item.kind || 'other') as ReferenceKind;
            return (
              <div
                key={item.id || item.file_name}
                className="flex min-w-[150px] max-w-[150px] flex-col gap-1 rounded-md border bg-muted/30 p-1"
              >
                <div className="aspect-video overflow-hidden rounded bg-black/10">
                  <img
                    src={item.url}
                    alt={item.original_name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="truncate text-[10px] font-medium">
                  {kindLabels[kind] || 'Other'}
                </div>

                <div className="truncate text-[9px] text-muted-foreground" title={item.original_name}>
                  {item.original_name}
                </div>

                <div className="text-[9px] text-muted-foreground">
                  {formatSize(item.size_bytes)}
                </div>

                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 flex-1 px-1 text-[9px]"
                    onClick={() => window.open(item.url, '_blank')}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 flex-1 px-1 text-[9px] text-red-600"
                    onClick={() => deleteReference(item)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {references.length === 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Belum ada image reference.
        </div>
      )}
    </div>
  );
}

