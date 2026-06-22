"use client";

import { CheckCircle2, Check, User, Calendar } from "lucide-react";

export interface ActiveFilters {
  incomplete: boolean;
  completed: boolean;
  justMyTasks: boolean;
  dueThisWeek: boolean;
  dueNextWeek: boolean;
}

export const DEFAULT_FILTERS: ActiveFilters = {
  incomplete: false,
  completed: false,
  justMyTasks: false,
  dueThisWeek: false,
  dueNextWeek: false,
};

interface Props {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  onClose: () => void;
}

const QUICK_FILTERS: Array<{ key: keyof ActiveFilters; label: string; Icon: React.ElementType }> =
  [
    { key: "incomplete",   label: "Incomplete tasks", Icon: CheckCircle2 },
    { key: "completed",    label: "Completed tasks",  Icon: Check },
    { key: "justMyTasks",  label: "Just my tasks",    Icon: User },
    { key: "dueThisWeek",  label: "Due this week",    Icon: Calendar },
    { key: "dueNextWeek",  label: "Due next week",    Icon: Calendar },
  ];

export default function FilterPanel({ filters, onChange, onClose }: Props) {
  const toggle = (key: keyof ActiveFilters) =>
    onChange({ ...filters, [key]: !filters[key] });

  const hasActive = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[8px] shadow-lg z-50 w-[460px]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E9]">
          <span className="text-sm font-semibold text-[#151B26]">Filters</span>
          {hasActive && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-sm text-[#4573D9] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-[#6B6F76] mb-3 uppercase tracking-wide">
            Quick filters
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  filters[key]
                    ? "bg-[#EEF2FB] border-[#4573D9] text-[#4573D9]"
                    : "border-[#E8E8E9] text-[#151B26] hover:bg-[#FAFBFC]"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
