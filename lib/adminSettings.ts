export interface StatusOption {
  key: string;
  label: string;
  bg: string;
  text: string;
  order: number;
}

export interface PriorityOption {
  key: string;
  label: string;
  bg: string;
  text: string;
  dot: string;
  order: number;
}

export interface StorageConfig {
  provider: "supabase" | "cloudflare" | "cloudinary" | "local";
  cloudflare: {
    account_id: string;
    access_key_id: string;
    secret_access_key: string;
    bucket: string;
    public_url: string;
  };
  cloudinary: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    upload_preset: string;
    folder: string;
  };
}

export const DEFAULT_STATUSES: StatusOption[] = [
  { key: "not_started",  label: "Not Started",  bg: "#F3F4F6", text: "#6B6F76", order: 0 },
  { key: "in_progress",  label: "In Progress",  bg: "#DBEAFE", text: "#1D4ED8", order: 1 },
  { key: "ready_for_qa", label: "Ready for QA", bg: "#EDE9FE", text: "#6D28D9", order: 2 },
  { key: "in_review",    label: "In Review",    bg: "#FEF3C7", text: "#B45309", order: 3 },
  { key: "done",         label: "Done",         bg: "#D1FAE5", text: "#065F46", order: 4 },
  { key: "blocked",      label: "Blocked",      bg: "#FEE2E2", text: "#B91C1C", order: 5 },
];

export const DEFAULT_PRIORITIES: PriorityOption[] = [
  { key: "show_stopper", label: "Show Stopper", bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", order: 0 },
  { key: "high",         label: "High",         bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", order: 1 },
  { key: "medium",       label: "Medium",       bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", order: 2 },
  { key: "low",          label: "Low",          bg: "#F3F4F6", text: "#6B6F76", dot: "#9CA3AF", order: 3 },
];

export interface TaskTypeOption {
  key: string;
  label: string;
  bg: string;
  text: string;
  order: number;
}

export const DEFAULT_TASK_TYPES: TaskTypeOption[] = [
  { key: "bug",        label: "Bug",        bg: "#FEE2E2", text: "#B91C1C", order: 0 },
  { key: "suggestion", label: "Suggestion", bg: "#D1FAE5", text: "#065F46", order: 1 },
  { key: "ui_fix",     label: "UI Fix",     bg: "#EDE9FE", text: "#6D28D9", order: 2 },
];

export const DEFAULT_STORAGE: StorageConfig = {
  provider: "supabase",
  cloudflare: { account_id: "", access_key_id: "", secret_access_key: "", bucket: "", public_url: "" },
  cloudinary: { cloud_name: "", api_key: "", api_secret: "", upload_preset: "", folder: "" },
};
