"use client";
import { useAdminSettings } from "@/lib/adminSettingsContext";

export default function PermissionsSection() {
  const { lockPriorities, requireAssigneeApproval, saveLockPriorities, saveRequireAssigneeApproval } = useAdminSettings();

  return (
    <section className="bg-white rounded-xl border border-[#E8E8E9] p-6">
      <h2 className="text-base font-semibold text-[#151B26] mb-4">Permissions</h2>
      <div className="flex flex-col gap-4">
        <Toggle
          label="Lock priorities"
          description="Users cannot change task priorities — only admin can."
          value={lockPriorities}
          onChange={saveLockPriorities}
        />
        <Toggle
          label="Require assignee approval"
          description="When a user assigns a task, admin must approve before it takes effect."
          value={requireAssigneeApproval}
          onChange={saveRequireAssigneeApproval}
        />
      </div>
    </section>
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
