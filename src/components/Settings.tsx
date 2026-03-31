"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { ApiConfig } from "@/lib/types";

const STORAGE_KEY = "apiConfigs";
const DEFAULT_BASE_URL = "https://platform-api.xaminim.com";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  configs: ApiConfig[];
  onConfigsChange: (configs: ApiConfig[]) => void;
}

export default function Settings({ open, onClose, configs, onConfigsChange }: SettingsProps) {
  const [localConfigs, setLocalConfigs] = useState<ApiConfig[]>(configs);

  useEffect(() => {
    if (open) setLocalConfigs(configs);
  }, [open, configs]);

  const addConfig = useCallback(() => {
    setLocalConfigs((prev) => [
      ...prev,
      { id: `api-${Date.now()}`, baseUrl: DEFAULT_BASE_URL, modelName: "", apiKey: "" },
    ]);
  }, []);

  const removeConfig = useCallback((id: string) => {
    setLocalConfigs((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateConfig = useCallback((id: string, field: keyof Omit<ApiConfig, "id">, value: string) => {
    setLocalConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }, []);

  const handleSave = useCallback(() => {
    const valid = localConfigs.filter((c) => c.modelName.trim() && c.apiKey.trim());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    onConfigsChange(valid);
    onClose();
  }, [localConfigs, onConfigsChange, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-2xl max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-primary">Settings</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-light hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-1">Anthropic API Configurations</h4>
            <p className="text-xs text-secondary">
              Configure API endpoints in priority order. On failure, you can choose to try the next one. Demo mode is used as final fallback. Timeout: 300s.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {localConfigs.map((config, index) => (
              <div
                key={config.id}
                className="rounded-lg border border-border bg-surface-light p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-secondary">API #{index + 1}</span>
                  <button
                    onClick={() => removeConfig(config.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Remove this config"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">Base URL</label>
                    <input
                      type="text"
                      value={config.baseUrl}
                      onChange={(e) => updateConfig(config.id, "baseUrl", e.target.value)}
                      placeholder="https://platform-api.xaminim.com"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">Model Name</label>
                    <input
                      type="text"
                      value={config.modelName}
                      onChange={(e) => updateConfig(config.id, "modelName", e.target.value)}
                      placeholder="e.g. claude-sonnet-4-5-20250514"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">API Key</label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => updateConfig(config.id, "apiKey", e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary placeholder:text-secondary/50 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
                    />
                  </div>
                </div>
              </div>
            ))}

            {localConfigs.length === 0 && (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <p className="text-sm text-secondary">No API configurations. Demo mode will be used.</p>
              </div>
            )}
          </div>

          <button
            onClick={addConfig}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-secondary transition-colors hover:border-accent-gold hover:text-accent-gold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add API Configuration
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-secondary transition-colors hover:bg-surface-light hover:text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:brightness-110"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function loadApiConfigs(): ApiConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
