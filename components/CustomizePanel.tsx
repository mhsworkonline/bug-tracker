"use client";

import { X, ChevronRight, ChevronDown, Zap, FileText, Mail, LayoutGrid, Package, TrendingUp, Circle } from "lucide-react";

interface Props {
  onClose: () => void;
}

const features = [
  { label: "Fields",           icon: Circle,      iconBg: "#FF8C42", badge: "1" },
  { label: "Rules",            icon: Zap,         iconBg: "#F7C325"             },
  { label: "Forms",            icon: FileText,    iconBg: "#6C63FF"             },
  { label: "Emails",           icon: Mail,        iconBg: "#4573D9"             },
  { label: "Apps",             icon: LayoutGrid,  iconBg: "#FF6B35"             },
  { label: "Bundles",          icon: Package,     iconBg: "#4573D9"             },
  { label: "Status templates", icon: TrendingUp,  iconBg: "#14A454"             },
];

export default function CustomizePanel({ onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-white z-50 shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E9] flex-shrink-0">
          <h2 className="text-xl font-bold text-[#151B26]">Customize</h2>
          <button onClick={onClose} className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-bold text-[#151B26]">This project</p>
              <p className="text-xs text-[#6B6F76] mt-0.5">View and edit features on this project</p>
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 border border-[#E8E8E9] text-sm text-[#151B26] rounded-md hover:bg-[#FAFBFC] flex-shrink-0">
              Add <ChevronDown size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.label}
                  className="flex items-center gap-3 w-full px-3 py-3 border border-[#E8E8E9] rounded-[6px] hover:bg-[#FAFBFC] text-left"
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: f.iconBg }}
                  >
                    <Icon size={16} color="white" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-[#151B26]">{f.label}</span>
                  {f.badge && (
                    <span className="text-xs bg-[#E8E8E9] text-[#6B6F76] rounded-full px-2 py-0.5 mr-1">
                      {f.badge}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-[#6B6F76]" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
