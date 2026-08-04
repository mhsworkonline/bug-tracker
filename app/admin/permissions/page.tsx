"use client";
import { Lock } from "lucide-react";
import { useAdminSettings } from "@/lib/adminSettingsContext";

export default function PermissionsPage() {
  const {
    lockPriorities, requireAssigneeApproval,
    membersCanManageMembers, membersCanExportJira, membersCanExportExcel,
    saveLockPriorities, saveRequireAssigneeApproval,
    saveMembersCanManageMembers, saveMembersCanExportJira, saveMembersCanExportExcel,
  } = useAdminSettings();

  return (
    <div>
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3 flex items-center gap-3">
        <Lock size={16} className="text-[#6B6F76]" />
        <h1 className="text-base font-semibold text-[#151B26]">Permissions</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">
        <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
          <h2 className="text-base font-semibold text-[#151B26] mb-1">Task permissions</h2>
          <p className="text-xs text-[#6B6F76] mb-4">Controls on what members can change on tasks.</p>
          <div className="flex flex-col gap-4">
            <Toggle
              label="Lock priorities"
              description="Members cannot change task priorities — only admin can."
              value={lockPriorities}
              onChange={saveLockPriorities}
            />
            <Toggle
              label="Require assignee approval"
              description="When a member assigns a task, admin must approve before it takes effect."
              value={requireAssigneeApproval}
              onChange={saveRequireAssigneeApproval}
            />
          </div>
        </section>

        <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
          <h2 className="text-base font-semibold text-[#151B26] mb-1">Membership</h2>
          <p className="text-xs text-[#6B6F76] mb-4">Controls on managing who's on a project.</p>
          <div className="flex flex-col gap-4">
            <Toggle
              label="Members can add/remove other members"
              description="When off, only admin can add, remove, or change roles of project members — project leads lose that ability."
              value={membersCanManageMembers}
              onChange={saveMembersCanManageMembers}
            />
          </div>
        </section>

        <section className="bg-white rounded-xl border border-[#E8E8E9] p-4 sm:p-6">
          <h2 className="text-base font-semibold text-[#151B26] mb-1">Export &amp; integrations</h2>
          <p className="text-xs text-[#6B6F76] mb-4">Controls on getting data out of a project.</p>
          <div className="flex flex-col gap-4">
            <Toggle
              label="Members can export/sync to Jira"
              description="When off, only admin sees the Jira integration button on a project."
              value={membersCanExportJira}
              onChange={saveMembersCanExportJira}
            />
            <Toggle
              label="Members can export to Excel/CSV/PDF"
              description="When off, only admin sees the Export or sync menu on a project."
              value={membersCanExportExcel}
              onChange={saveMembersCanExportExcel}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#151B26]">{label}</p>
        <p className="text-xs text-[#6B6F76] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${value ? "bg-[#4573D9]" : "bg-[#D0D2D6]"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
