'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  TestTube2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useStoryboardStore } from '@/lib/store/storyboard-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProviderWithId {
  id: string;
  type: string;
  name: string;
  provider: string;
  base_url: string;
  endpoint: string | null;
  model: string;
  api_key: string | null;
  timeout_seconds: number;
  is_default: boolean;
  is_active: boolean;
  config_json: string;
}

interface ProviderFormData {
  name: string;
  provider: string;
  base_url: string;
  endpoint: string;
  model: string;
  api_key: string;
  timeout_seconds: number;
  is_default: boolean;
  is_active: boolean;
}

const EMPTY_FORM: ProviderFormData = {
  name: '',
  provider: 'openai_compatible',
  base_url: '',
  endpoint: '',
  model: '',
  api_key: '',
  timeout_seconds: 600,
  is_default: false,
  is_active: true,
};

export function ProviderSettingsDialog() {
  const { providerSettingsDialogOpen, setProviderSettingsDialogOpen } = useStoryboardStore();
  const [providers, setProviders] = useState<ProviderWithId[]>([]);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Fetch providers on dialog open
  useEffect(() => {
    if (providerSettingsDialogOpen) {
      fetchProviders();
    }
  }, [providerSettingsDialogOpen]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/storyboard/providers');
      const data = await res.json();
      if (data.ok) {
        setProviders(data.providers || []);
      }
    } catch {
      // Silently fail
    }
  };

  const filteredProviders = providers.filter(p => p.type === activeTab);

  const handleNew = useCallback(() => {
    setEditingId(null);
    setIsNew(true);
    setForm({ ...EMPTY_FORM });
    setTestResult(null);
  }, []);

  const handleEdit = useCallback((provider: ProviderWithId) => {
    setEditingId(provider.id);
    setIsNew(false);
    setForm({
      name: provider.name,
      provider: provider.provider,
      base_url: provider.base_url,
      endpoint: provider.endpoint || '',
      model: provider.model,
      api_key: provider.api_key || '',
      timeout_seconds: provider.timeout_seconds,
      is_default: provider.is_default,
      is_active: provider.is_active,
    });
    setTestResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.base_url || !form.model) {
      toast.error('Name, Base URL, and Model are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId && !isNew) {
        // Update existing provider
        const res = await fetch(`/api/storyboard/providers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            type: activeTab,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          toast.success('Provider updated');
        } else {
          toast.error(data.error || 'Failed to update provider');
        }
      } else {
        // Create new provider
        const res = await fetch('/api/storyboard/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            type: activeTab,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          toast.success('Provider created');
        } else {
          toast.error(data.error || 'Failed to create provider');
        }
      }
      fetchProviders();
      setEditingId(null);
      setIsNew(false);
      setForm(EMPTY_FORM);
    } catch {
      toast.error('Failed to save provider');
    } finally {
      setSaving(false);
    }
  }, [form, activeTab, editingId, isNew]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/storyboard/providers/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Provider deleted');
        fetchProviders();
        if (editingId === id) {
          setEditingId(null);
          setIsNew(false);
          setForm(EMPTY_FORM);
        }
      } else {
        toast.error(data.error || 'Failed to delete provider');
      }
    } catch {
      toast.error('Failed to delete provider');
    }
  }, [editingId]);

  const handleTest = useCallback(async () => {
    if (!form.base_url) {
      toast.error('Base URL is required for testing');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/storyboard/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: form.base_url,
          type: activeTab,
          api_key: form.api_key,
        }),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok,
        message: data.ok ? data.message : (data.message || data.error || 'Connection failed'),
      });
    } catch {
      setTestResult({ ok: false, message: 'Connection failed - server error' });
    } finally {
      setTesting(false);
    }
  }, [form, activeTab]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setIsNew(false);
    setForm(EMPTY_FORM);
    setTestResult(null);
  }, []);

  return (
    <Dialog open={providerSettingsDialogOpen} onOpenChange={setProviderSettingsDialogOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-600" />
            Provider Settings
          </DialogTitle>
          <DialogDescription>
            Configure image and video generation providers.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'video')}>
          <TabsList>
            <TabsTrigger value="image">Image Provider</TabsTrigger>
            <TabsTrigger value="video">Video Provider</TabsTrigger>
          </TabsList>

          <div className="mt-3 flex gap-4 min-h-0 flex-1">
            {/* Provider List */}
            <div className="w-56 shrink-0 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={handleNew}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>
              <ScrollArea className="flex-1 max-h-60">
                <div className="space-y-1">
                  {filteredProviders.map((provider) => {
                    const isSelected = provider.id === editingId;
                    return (
                      <button
                        key={provider.id}
                        className={cn(
                          'w-full text-left rounded-md p-2 transition-colors text-xs',
                          'hover:bg-accent/50',
                          isSelected ? 'bg-emerald-50 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800' : 'border border-transparent',
                          !provider.is_active && 'opacity-50'
                        )}
                        onClick={() => handleEdit(provider)}
                      >
                        <div className="font-medium truncate">{provider.name}</div>
                        <div className="text-[10px] text-muted-foreground">{provider.model}</div>
                        <div className="flex gap-1 mt-0.5">
                          {provider.is_default && (
                            <span className="text-[9px] text-emerald-600 font-medium">Default</span>
                          )}
                          {!provider.is_active && (
                            <span className="text-[9px] text-muted-foreground">Inactive</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredProviders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No {activeTab} providers configured
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <Separator orientation="vertical" className="h-auto" />

            {/* Edit Form */}
            <div className="flex-1 min-w-0">
              {(isNew || editingId) ? (
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-3 pr-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8 text-sm"
                        value={form.name}
                        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="My Provider"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        className="h-8 text-sm font-mono"
                        value={form.base_url}
                        onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
                        placeholder="http://127.0.0.1:9100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endpoint</Label>
                      <Input
                        className="h-8 text-sm font-mono"
                        value={form.endpoint}
                        onChange={(e) => setForm(f => ({ ...f, endpoint: e.target.value }))}
                        placeholder="/v1/images/generations"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input
                        className="h-8 text-sm"
                        value={form.model}
                        onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                        placeholder="z-image-turbo"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        className="h-8 text-sm font-mono"
                        type="password"
                        value={form.api_key}
                        onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))}
                        placeholder="local"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Timeout (seconds)</Label>
                      <Input
                        className="h-8 text-sm w-24"
                        type="number"
                        value={form.timeout_seconds}
                        onChange={(e) => setForm(f => ({ ...f, timeout_seconds: parseInt(e.target.value) || 600 }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.is_default}
                          onCheckedChange={(checked) => setForm(f => ({ ...f, is_default: checked }))}
                        />
                        <Label className="text-xs">Set as Default</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.is_active}
                          onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                        />
                        <Label className="text-xs">Active</Label>
                      </div>
                    </div>

                    <Separator />

                    {/* Test Connection */}
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={handleTest}
                        disabled={testing || !form.base_url}
                      >
                        {testing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TestTube2 className="h-3.5 w-3.5" />
                        )}
                        Test Connection
                      </Button>
                      {testResult && (
                        <div
                          className={cn(
                            'flex items-center gap-2 p-2 rounded text-xs',
                            testResult.ok
                              ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                          )}
                        >
                          {testResult.ok ? (
                            <CheckCircle className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {testResult.message}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Select a provider or add a new one
                </div>
              )}
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          {(isNew || editingId) && (
            <>
              <Button variant="outline" onClick={handleCancel} size="sm">
                Cancel
              </Button>
              {editingId && !isNew && (
                <Button
                  variant="outline"
                  onClick={() => handleDelete(editingId)}
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
