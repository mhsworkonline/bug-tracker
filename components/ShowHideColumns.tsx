"use client";

import { ArrowLeft, User, Calendar, Tag, Clock, CheckCircle2, Folder, Paperclip, Users, Pencil, MinusCircle, PlusCircle } from "lucide-react";
import type { ColumnConfig, ColumnKey } from "@/lib/data";
import { COLUMN_LABELS } from "@/lib/data";

const COLUMN_ICONS: Record<ColumnKey, React.ElementType> = {
  status:          CheckCircle2,
  assignee:        User,
  due_date:        Calendar,
  priority:        Tag,
  task_type:       Tag,
  collaborators:   Users,
  created_by:      User,
  created_on:      Clock,
  last_modified_on:Pencil,
  completed_on:    CheckCircle2,
  projects:        Folder,
  tags:            Tag,
  blocked_by:      MinusCircle,
  blocking:        PlusCircle,
  attachments:     Paperclip,
};

interface Props {
  configs: ColumnConfig[];
  onToggle: (key: ColumnKey, visible: boolean) => void;
  onClose: () => void;
}

export default function ShowHideColumns({ configs, onToggle, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[320px] bg-white z-50 shadow-xl flex flex-col border-l border-[#E8E8E9]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8E8E9] flex-shrink-0">
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-semibold text-[#151B26]">Show/hide columns</h2>
        </div>

        {/* Subheader */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E9] flex-shrink-0">
          <p className="text-xs text-[#6B6F76]">Show, hide, and reorder columns in this view</p>
          <button className="flex items-center gap-1 px-2.5 py-1 border border-[#E8E8E9] text-xs text-[#151B26] rounded hover:bg-[#FAFBFC]">
            + Add
          </button>
        </div>

        {/* Column list */}
        <div className="flex-1 overflow-y-auto">
          {configs.map((col) => {
            const Icon = COLUMN_ICONS[col.column_key as ColumnKey] ?? Tag;
            return (
              <div
                key={col.column_key}
                className="flex items-center gap-3 px-5 py-3 border-b border-[#E8E8E9] hover:bg-[#FAFBFC]"
              >
                <Icon size={15} className="text-[#6B6F76] flex-shrink-0" />
                <span className="flex-1 text-sm text-[#151B26]">
                  {COLUMN_LABELS[col.column_key as ColumnKey]}
                </span>
                {/* Toggle */}
                <button
                  onClick={() => onToggle(col.column_key as ColumnKey, !col.visible)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 overflow-hidden ${
                    col.visible ? "bg-[#4573D9]" : "bg-[#D1D5DB]"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      col.visible ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8E8E9] flex-shrink-0">
          <button className="flex items-center gap-1 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded hover:bg-[#3F65C4]">
            Save view
          </button>
          <button className="flex items-center gap-1 px-2 py-1.5 border border-[#E8E8E9] text-[#6B6F76] text-sm rounded hover:bg-[#FAFBFC]">
            ⌄
          </button>
        </div>
      </div>
    </>
  );
}
