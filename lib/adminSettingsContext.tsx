"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_PRIORITIES, DEFAULT_STATUSES, DEFAULT_STORAGE,
  type PriorityOption, type StatusOption, type StorageConfig,
} from "@/lib/adminSettings";

interface AdminSettings {
  statuses: StatusOption[];
  priorities: PriorityOption[];
  storageConfig: StorageConfig;
  statusByKey: (key: string) => StatusOption;
  priorityByKey: (key: string) => PriorityOption | null;
  saveStatuses: (v: StatusOption[]) => Promise<void>;
  savePriorities: (v: PriorityOption[]) => Promise<void>;
  saveStorageConfig: (v: StorageConfig) => Promise<void>;
}

const FALLBACK_STATUS: StatusOption = { key: "", label: "Unknown", bg: "#F3F4F6", text: "#6B6F76", order: 99 };

const Ctx = createContext<AdminSettings>({
  statuses: DEFAULT_STATUSES,
  priorities: DEFAULT_PRIORITIES,
  storageConfig: DEFAULT_STORAGE,
  statusByKey: () => FALLBACK_STATUS,
  priorityByKey: () => null,
  saveStatuses: async () => {},
  savePriorities: async () => {},
  saveStorageConfig: async () => {},
});

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses]         = useState<StatusOption[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities]     = useState<PriorityOption[]>(DEFAULT_PRIORITIES);
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(DEFAULT_STORAGE);

  useEffect(() => {
    supabase.from("BT_settings").select("*").then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === "status_config")   setStatuses(row.value);
        if (row.key === "priority_config") setPriorities(row.value);
        if (row.key === "storage_config")  setStorageConfig(row.value);
      }
    });
  }, []);

  const statusByKey = useCallback((key: string): StatusOption => {
    return statuses.find(s => s.key === key) ?? { ...FALLBACK_STATUS, key, label: key };
  }, [statuses]);

  const priorityByKey = useCallback((key: string): PriorityOption | null => {
    return priorities.find(p => p.key === key) ?? null;
  }, [priorities]);

  const saveStatuses = useCallback(async (next: StatusOption[]) => {
    setStatuses(next);
    await supabase.from("BT_settings").upsert({ key: "status_config", value: next, updated_at: new Date().toISOString() });
  }, []);

  const savePriorities = useCallback(async (next: PriorityOption[]) => {
    setPriorities(next);
    await supabase.from("BT_settings").upsert({ key: "priority_config", value: next, updated_at: new Date().toISOString() });
  }, []);

  const saveStorageConfig = useCallback(async (next: StorageConfig) => {
    setStorageConfig(next);
    await supabase.from("BT_settings").upsert({ key: "storage_config", value: next, updated_at: new Date().toISOString() });
  }, []);

  return (
    <Ctx.Provider value={{ statuses, priorities, storageConfig, statusByKey, priorityByKey, saveStatuses, savePriorities, saveStorageConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminSettings() { return useContext(Ctx); }
