"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";

interface Props {
  value?: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}

export default function TaskTypeBadge({ value, onChange, compact }: Props) {
  const { taskTypes, taskTypeByKey } = useAdminSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = value ? taskTypeByKey(value) : null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 rounded-full text-xs font-medium whitespace-nowrap ${compact ? "px-2 py-0.5" : "px-2.5 py-1"}`}
        style={current
          ? { backgroundColor: current.bg, color: current.text }
          : { backgroundColor: "#F3F4F6", color: "#9EA3AA" }
        }
      >
        {current ? current.label : null}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[6px] shadow-lg z-50 py-1 w-44">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#FAFBFC] text-left text-xs text-[#9EA3AA]"
          >
            None
          </button>
          {[...taskTypes].sort((a, b) => a.order - b.order).map(t => (
            <button
              key={t.key}
              onClick={() => { onChange(t.key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#FAFBFC] text-left"
            >
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: t.bg, color: t.text }}>
                {t.label}
              </span>
              {t.key === value && <span className="ml-auto text-[#4573D9] text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
