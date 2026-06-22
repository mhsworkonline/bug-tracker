"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";

interface Props {
  value?: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
  disabled?: boolean;
}

export default function PriorityBadge({ value, onChange, compact, disabled }: Props) {
  const { priorities, priorityByKey } = useAdminSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = value ? priorityByKey(value) : null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        className={`flex items-center gap-1 rounded-full text-xs font-medium whitespace-nowrap ${compact ? "px-2 py-0.5" : "px-2.5 py-1"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        style={current
          ? { backgroundColor: current.bg, color: current.text }
          : { backgroundColor: "#F3F4F6", color: "#6B6F76" }
        }
        title={disabled ? "Priority is locked by admin" : undefined}
      >
        {current ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: current.dot }} />
            {current.label}
          </>
        ) : null}
        {disabled ? <Lock size={9} /> : <ChevronDown size={10} />}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-[#E8E8E9] rounded-[6px] shadow-lg z-50 py-1 w-44">
          <button onClick={() => { onChange(null); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#FAFBFC] text-left text-sm text-[#6B6F76]">
            None
          </button>
          {[...priorities].sort((a, b) => a.order - b.order).map(p => (
            <button key={p.key} onClick={() => { onChange(p.key); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#FAFBFC] text-left">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.dot }} />
              <span className="text-xs font-medium text-[#151B26]">{p.label}</span>
              {p.key === value && <span className="ml-auto text-[#4573D9] text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
