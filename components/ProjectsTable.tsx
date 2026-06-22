"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { Project } from "@/lib/data";

export default function ProjectsTable({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="border border-[#E8E8E9] rounded-[6px] px-6 py-12 text-center text-sm text-[#6B6F76]">
        No projects found.
      </div>
    );
  }

  return (
    <div className="border border-[#E8E8E9] rounded-[6px] overflow-hidden">
      <div className="flex items-center px-4 py-2.5 bg-[#FAFBFC] border-b border-[#E8E8E9]">
        <div className="flex-1 text-xs font-medium text-[#6B6F76]">Name</div>
        <div className="w-32 text-xs font-medium text-[#6B6F76]">Members</div>
        <div className="w-32 text-xs font-medium text-[#6B6F76]">Portfolios</div>
        <div className="w-44 flex items-center justify-end gap-1 text-xs font-medium text-[#6B6F76]">
          Last modified <ArrowUpDown size={12} />
        </div>
      </div>

      {projects.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center px-4 py-3 hover:bg-[#FAFBFC] transition-colors ${
            i < projects.length - 1 ? "border-b border-[#E8E8E9]" : ""
          }`}
        >
          <div className="flex-1 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-[6px] flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: p.icon_bg }}
            >
              {p.name[0]}
            </div>
            <div>
              <Link
                href={`/projects/${p.id}`}
                className="text-sm font-semibold text-[#151B26] hover:underline"
              >
                {p.name}
              </Link>
              <p className="text-xs font-medium" style={{ color: "#14A454" }}>
                Joined
              </p>
            </div>
          </div>

          <div className="w-32 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#D9822B] flex items-center justify-center text-white text-xs font-semibold">
              MH
            </div>
            <button className="text-[#6B6F76] text-sm px-1 hover:text-[#151B26]">···</button>
          </div>

          <div className="w-32 text-sm text-[#6B6F76]">—</div>
          <div className="w-44 text-right text-sm text-[#6B6F76]">
            {new Date(p.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
