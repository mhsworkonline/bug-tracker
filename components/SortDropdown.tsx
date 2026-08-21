"use client";

import {
  Calendar, User, Clock, CheckCircle2, ThumbsUp, SortAsc, Tag, Folder, Circle, ArrowUp, ArrowDown, X,
} from "lucide-react";

export type SortKey =
  | "none"
  | "dueDate"
  | "assignee"
  | "createdBy"
  | "createdAt"
  | "lastModifiedAt"
  | "completedAt"
  | "likes"
  | "alphabetical"
  | "priority"
  | "status"
  | "project";

interface Props {
  current: SortKey;
  dir: "asc" | "desc";
  onChange: (key: SortKey) => void;
  onClose: () => void;
}

const OPTIONS: Array<{ key: SortKey; label: string; Icon: React.ElementType }> = [
  { key: "dueDate",        label: "Due date",         Icon: Calendar },
  { key: "assignee",       label: "Assignee",          Icon: User },
  { key: "createdBy",      label: "Created by",        Icon: User },
  { key: "createdAt",      label: "Created on",        Icon: Clock },
  { key: "lastModifiedAt", label: "Last modified on",  Icon: Clock },
  { key: "completedAt",    label: "Completed on",      Icon: CheckCircle2 },
  { key: "likes",          label: "Likes",             Icon: ThumbsUp },
  { key: "alphabetical",   label: "Alphabetical",      Icon: SortAsc },
  { key: "priority",       label: "Priority",          Icon: Tag },
  { key: "status",         label: "Status",            Icon: Circle },
  { key: "project",        label: "Project",           Icon: Folder },
];

export default function SortDropdown({ current, dir, onChange, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg z-50 w-52 py-1">
        {current !== "none" && (
          <button
            onClick={() => { onChange("none"); onClose(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left text-[#6B6F76] hover:bg-[#FAFBFC] border-b border-[#F0F1F3]"
          >
            <X size={14} className="text-[#6B6F76]" />
            Clear sort
          </button>
        )}
        {OPTIONS.map(({ key, label, Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              // Picking the already-active option flips direction (asc/desc), same as
              // clicking a column header twice — matches the header's own toggle behavior.
              onClick={() => { onChange(key); if (!active) onClose(); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors ${
                active ? "bg-[#EEF2FB] text-[#4573D9]" : "text-[#151B26] hover:bg-[#FAFBFC]"
              }`}
            >
              <Icon size={14} className={active ? "text-[#4573D9]" : "text-[#6B6F76]"} />
              <span className="flex-1">{label}</span>
              {active && (dir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
            </button>
          );
        })}
      </div>
    </>
  );
}
