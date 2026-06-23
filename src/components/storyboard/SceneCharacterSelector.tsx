'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type CharacterRef = {
  id?: string;
  kind?: string;
  name?: string;
  role?: string;
  file_name?: string;
  original_name?: string;
  url?: string;
};

type Props = {
  projectId: string;
  sceneId: string;
};

function labelForCharacter(item: CharacterRef) {
  return item.name || item.original_name || item.file_name || item.id || 'Character';
}

export function SceneCharacterSelector({ projectId, sceneId }: Props) {
  const [characters, setCharacters] = useState<CharacterRef[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !sceneId) return;

    try {
      setLoading(true);
      const res = await fetch(
        `/api/storyboard/${projectId}/scenes/${sceneId}/character-refs`,
        { cache: 'no-store' }
      );
      const data = await res.json();

      if (data.ok) {
        setCharacters(Array.isArray(data.characters) ? data.characters : []);
        setSelected(Array.isArray(data.character_refs) ? data.character_refs.slice(0, 2) : []);
      } else {
        console.error('[scene character refs load]', data);
      }
    } catch (error) {
      console.error('[scene character refs load]', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, sceneId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (nextSelected: string[]) => {
    try {
      setSaving(true);
      const clean = nextSelected.filter(Boolean).slice(0, 2);

      const res = await fetch(
        `/api/storyboard/${projectId}/scenes/${sceneId}/character-refs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_refs: clean }),
        }
      );

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || 'Gagal menyimpan karakter scene');
        console.error('[scene character refs save]', data);
        return;
      }

      setSelected(Array.isArray(data.character_refs) ? data.character_refs.slice(0, 2) : []);
    } catch (error) {
      console.error('[scene character refs save]', error);
      alert('Gagal menyimpan karakter scene');
    } finally {
      setSaving(false);
    }
  };

  const setSlot = (index: number, value: string) => {
    const next = [...selected];
    next[index] = value;

    if (next[0] && next[1] && next[0] === next[1]) {
      if (index === 0) next[1] = '';
      if (index === 1) next[0] = '';
    }

    save(next);
  };

  if (!projectId || !sceneId) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold">Scene Character Reference</div>
          <div className="text-[10px] text-muted-foreground">
            Pilih maksimal 2 karakter untuk scene ini
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          disabled={loading || saving}
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">
          Belum ada character reference. Upload dulu di panel Image Reference.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Character 1</span>
            <select
              className="h-8 rounded border bg-background px-2 text-xs"
              value={selected[0] || ''}
              disabled={saving}
              onChange={(event) => setSlot(0, event.target.value)}
            >
              <option value="">Tidak pakai</option>
              {characters.map((item) => (
                <option key={item.id} value={item.id}>
                  {labelForCharacter(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Character 2</span>
            <select
              className="h-8 rounded border bg-background px-2 text-xs"
              value={selected[1] || ''}
              disabled={saving}
              onChange={(event) => setSlot(1, event.target.value)}
            >
              <option value="">Tidak pakai</option>
              {characters.map((item) => (
                <option key={item.id} value={item.id}>
                  {labelForCharacter(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
