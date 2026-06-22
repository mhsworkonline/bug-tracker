"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_PRIORITIES, DEFAULT_STATUSES, DEFAULT_STORAGE, DEFAULT_TASK_TYPES,
  type PriorityOption, type StatusOption, type StorageConfig, type TaskTypeOption,
} from "@/lib/adminSettings";

interface AdminSettings {
  statuses: StatusOption[];
  priorities: PriorityOption[];
  taskTypes: TaskTypeOption[];
  storageConfig: StorageConfig;
  lockPriorities: boolean;
  requireAssigneeApproval: boolean;
  statusByKey: (key: string) => StatusOption;
  priorityByKey: (key: string) => PriorityOption | null;
  taskTypeByKey: (key: string) => TaskTypeOption | null;
  saveStatuses: (v: StatusOption[]) => Promise<void>;
  savePriorities: (v: PriorityOption[]) => Promise<void>;
  saveTaskTypes: (v: TaskTypeOption[]) => Promise<void>;
  saveStorageConfig: (v: StorageConfig) => Promise<void>;
  saveLockPriorities: (v: boolean) => Promise<void>;
  saveRequireAssigneeApproval: (v: boolean) => Promise<void>;
}

const FALLBACK_STATUS: StatusOption = { key: "", label: "Unknown", bg: "#F3F4F6", text: "#6B6F76", order: 99 };

const Ctx = createContext<AdminSettings>({
  statuses: DEFAULT_STATUSES, priorities: DEFAULT_PRIORITIES,
  taskTypes: DEFAULT_TASK_TYPES, storageConfig: DEFAULT_STORAGE,
  lockPriorities: false, requireAssigneeApproval: false,
  statusByKey: () => FALLBACK_STATUS, priorityByKey: () => null, taskTypeByKey: () => null,
  saveStatuses: async () => {}, savePriorities: async () => {}, saveTaskTypes: async () => {},
  saveStorageConfig: async () => {}, saveLockPriorities: async () => {}, saveRequireAssigneeApproval: async () => {},
});

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses]         = useState<StatusOption[]>(DEFAULT_STATUSES);
  const [priorities, setPriorities]     = useState<PriorityOption[]>(DEFAULT_PRIORITIES);
  const [taskTypes, setTaskTypes]       = useState<TaskTypeOption[]>(DEFAULT_TASK_TYPES);
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(DEFAULT_STORAGE);
  const [lockPriorities, setLockPriorities]                 = useState(false);
  const [requireAssigneeApproval, setRequireAssigneeApproval] = useState(false);

  useEffect(() => {
    supabase.from("BT_settings").select("*").then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === "status_config")             setStatuses(row.value);
        if (row.key === "priority_config")           setPriorities(row.value);
        if (row.key === "task_type_config")          setTaskTypes(row.value);
        if (row.key === "storage_config")            setStorageConfig(row.value);
        if (row.key === "lock_priorities")           setLockPriorities(row.value === true || row.value?.enabled === true);
        if (row.key === "require_assignee_approval") setRequireAssigneeApproval(row.value === true || row.value?.enabled === true);
      }
    });
  }, []);

  const statusByKey   = useCallback((key: string): StatusOption =>
    statuses.find(s => s.key === key) ?? { ...FALLBACK_STATUS, key, label: key }, [statuses]);
  const priorityByKey = useCallback((key: string): PriorityOption | null =>
    priorities.find(p => p.key === key) ?? null, [priorities]);
  const taskTypeByKey = useCallback((key: string): TaskTypeOption | null =>
    taskTypes.find(t => t.key === key) ?? null, [taskTypes]);

  const upsert = (key: string, value: unknown) =>
    supabase.from("BT_settings").upsert({ key, value, updated_at: new Date().toISOString() });

  const saveStatuses     = useCallback(async (v: StatusOption[])   => { setStatuses(v);     await upsert("status_config", v); }, []);
  const savePriorities   = useCallback(async (v: PriorityOption[]) => { setPriorities(v);   await upsert("priority_config", v); }, []);
  const saveTaskTypes    = useCallback(async (v: TaskTypeOption[]) => { setTaskTypes(v);    await upsert("task_type_config", v); }, []);
  const saveStorageConfig = useCallback(async (v: StorageConfig)   => { setStorageConfig(v); await upsert("storage_config", v); }, []);
  const saveLockPriorities = useCallback(async (v: boolean) => { setLockPriorities(v); await upsert("lock_priorities", v); }, []);
  const saveRequireAssigneeApproval = useCallback(async (v: boolean) => { setRequireAssigneeApproval(v); await upsert("require_assignee_approval", v); }, []);

  return (
    <Ctx.Provider value={{
      statuses, priorities, taskTypes, storageConfig,
      lockPriorities, requireAssigneeApproval,
      statusByKey, priorityByKey, taskTypeByKey,
      saveStatuses, savePriorities, saveTaskTypes, saveStorageConfig,
      saveLockPriorities, saveRequireAssigneeApproval,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminSettings() { return useContext(Ctx); }
