"use client";
import { CheckCircle2, Check, User, Calendar, X } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";

export interface ActiveFilters {
  incomplete: boolean;
  completed: boolean;
  justMyTasks: boolean;
  dueThisWeek: boolean;
  dueNextWeek: boolean;
  statuses: string[];
  priorities: string[];
  taskTypes: string[];
  assignees: string[];
}

export const DEFAULT_FILTERS: ActiveFilters = {
  incomplete: false, completed: false, justMyTasks: false,
  dueThisWeek: false, dueNextWeek: false,
  statuses: [], priorities: [], taskTypes: [], assignees: [],
};

interface Props {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  onClose: () => void;
  members?: { id: string; email: string; name?: string }[];
}

const QUICK: Array<{ key: keyof ActiveFilters; label: string; Icon: React.ElementType }> = [
  { key: "incomplete",  label: "Incomplete tasks", Icon: CheckCircle2 },
  { key: "completed",   label: "Completed tasks",  Icon: Check },
  { key: "justMyTasks", label: "Just my tasks",    Icon: User },
  { key: "dueThisWeek", label: "Due this week",    Icon: Calendar },
  { key: "dueNextWeek", label: "Due next week",    Icon: Calendar },
];

function toggleArr(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function Pills({ items, active, onToggle }: { items: { value: string; label: string }[]; active: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map(({ value, label }) => (
        <button key={value} onClick={() => onToggle(value)}
          className={`px-3 py-1 rounded-full border text-xs transition-colors ${active.includes(value) ? "bg-[#EEF2FB] border-[#4573D9] text-[#4573D9]" : "border-[#E8E8E9] text-[#151B26] hover:bg-[#FAFBFC]"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function FilterPanel({ filters, onChange, onClose, members = [] }: Props) {
  const { statuses, priorities, taskTypes } = useAdminSettings();
  const hasActive = filters.incomplete || filters.completed || filters.justMyTasks ||
    filters.dueThisWeek || filters.dueNextWeek ||
    filters.statuses.length > 0 || filters.priorities.length > 0 ||
    filters.taskTypes.length > 0 || filters.assignees.length > 0;

  const set = (patch: Partial<ActiveFilters>) => onChange({ ...filters, ...patch });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg z-50 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E9] sticky top-0 bg-white">
          <span className="text-sm font-semibold text-[#151B26]">Filters</span>
          <div className="flex items-center gap-2">
            {hasActive && <button onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs text-[#4573D9] hover:underline">Clear all</button>}
            <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={14} /></button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Quick filters */}
          <div>
            <p className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide mb-2">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => set({ [key]: !filters[key as keyof ActiveFilters] })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${filters[key as keyof ActiveFilters] ? "bg-[#EEF2FB] border-[#4573D9] text-[#4573D9]" : "border-[#E8E8E9] text-[#151B26] hover:bg-[#FAFBFC]"}`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          {statuses.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide">Status</p>
                {filters.statuses.length > 0 && <button onClick={() => set({ statuses: [] })} className="text-xs text-[#4573D9]">Clear</button>}
              </div>
              <Pills
                items={statuses.map((s: { key: string; label: string }) => ({ value: s.key, label: s.label }))}
                active={filters.statuses}
                onToggle={v => set({ statuses: toggleArr(filters.statuses, v) })}
              />
            </div>
          )}

          {/* Priority */}
          {priorities.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide">Priority</p>
                {filters.priorities.length > 0 && <button onClick={() => set({ priorities: [] })} className="text-xs text-[#4573D9]">Clear</button>}
              </div>
              <Pills
                items={priorities.map((p: { key: string; label: string }) => ({ value: p.key, label: p.label }))}
                active={filters.priorities}
                onToggle={v => set({ priorities: toggleArr(filters.priorities, v) })}
              />
            </div>
          )}

          {/* Task Type */}
          {taskTypes.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide">Task Type</p>
                {filters.taskTypes.length > 0 && <button onClick={() => set({ taskTypes: [] })} className="text-xs text-[#4573D9]">Clear</button>}
              </div>
              <Pills
                items={taskTypes.map((t: { key: string; label: string }) => ({ value: t.key, label: t.label }))}
                active={filters.taskTypes}
                onToggle={v => set({ taskTypes: toggleArr(filters.taskTypes, v) })}
              />
            </div>
          )}

          {/* Assignee */}
          {members.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6B6F76] uppercase tracking-wide">Assignee</p>
                {filters.assignees.length > 0 && <button onClick={() => set({ assignees: [] })} className="text-xs text-[#4573D9]">Clear</button>}
              </div>
              <Pills
                items={members.map(m => ({ value: m.email, label: m.name ?? m.email }))}
                active={filters.assignees}
                onToggle={v => set({ assignees: toggleArr(filters.assignees, v) })}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
