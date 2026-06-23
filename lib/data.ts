export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_qa"
  | "in_review"
  | "done"
  | "blocked";

export type TaskPriority = "show_stopper" | "high" | "medium" | "low";

export type ColumnKey =
  | "status"
  | "assignee"
  | "due_date"
  | "priority"
  | "task_type"
  | "collaborators"
  | "created_by"
  | "created_on"
  | "last_modified_on"
  | "completed_on"
  | "projects"
  | "tags"
  | "blocked_by"
  | "blocking"
  | "attachments";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started:  "Not Started",
  in_progress:  "In Progress",
  ready_for_qa: "Ready for QA",
  in_review:    "In Review",
  done:         "Done",
  blocked:      "Blocked",
};

export const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  not_started:  { bg: "#F3F4F6", text: "#6B6F76" },
  in_progress:  { bg: "#DBEAFE", text: "#1D4ED8" },
  ready_for_qa: { bg: "#EDE9FE", text: "#6D28D9" },
  in_review:    { bg: "#FEF3C7", text: "#B45309" },
  done:         { bg: "#D1FAE5", text: "#065F46" },
  blocked:      { bg: "#FEE2E2", text: "#B91C1C" },
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  show_stopper: "Show Stopper",
  high:         "High",
  medium:       "Medium",
  low:          "Low",
};

export const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; dot: string }> = {
  show_stopper: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444" },
  high:         { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  medium:       { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  low:          { bg: "#F3F4F6", text: "#6B6F76", dot: "#9CA3AF" },
};

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  status:          "Status",
  assignee:        "Assignee",
  due_date:        "Due date",
  priority:        "Priority",
  task_type:       "Task Type",
  collaborators:   "Collaborators",
  created_by:      "Created by",
  created_on:      "Created on",
  last_modified_on:"Last modified on",
  completed_on:    "Completed on",
  projects:        "Projects",
  tags:            "Tags",
  blocked_by:      "Blocked by",
  blocking:        "Blocking",
  attachments:     "Attachments",
};

export interface Attachment {
  id: string;
  task_id: string;
  name: string;
  url: string;
  file_type: string;
  size: number;
  uploaded_at: string;
}

export interface Task {
  id: string;
  section_id: string | null;
  project_id: string;
  name: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  task_type?: string | null;
  assignee?: string | null;
  due_date?: string | null;
  completed: boolean;
  completed_at?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  BT_attachments?: Attachment[];
}

export interface Section {
  id: string;
  project_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  icon_bg: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ColumnConfig {
  id: string;
  project_id: string;
  column_key: ColumnKey;
  visible: boolean;
  position: number;
}

export const DEFAULT_COLUMNS: Array<{ key: ColumnKey; defaultVisible: boolean }> = [
  { key: "status",          defaultVisible: true  },
  { key: "assignee",        defaultVisible: true  },
  { key: "due_date",        defaultVisible: true  },
  { key: "priority",        defaultVisible: true  },
  { key: "task_type",       defaultVisible: true  },
  { key: "collaborators",   defaultVisible: false },
  { key: "created_by",      defaultVisible: false },
  { key: "created_on",      defaultVisible: false },
  { key: "last_modified_on",defaultVisible: false },
  { key: "completed_on",    defaultVisible: false },
  { key: "projects",        defaultVisible: false },
  { key: "tags",            defaultVisible: false },
  { key: "blocked_by",      defaultVisible: false },
  { key: "blocking",        defaultVisible: false },
  { key: "attachments",     defaultVisible: false },
];
