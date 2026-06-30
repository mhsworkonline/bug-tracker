"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PermissionsSection from "../PermissionsSection";
import AssignmentRequestsSection from "../AssignmentRequestsSection";
import StatusSection from "../StatusSection";
import PrioritySection from "../PrioritySection";
import TaskTypeSection from "../TaskTypeSection";
import StorageSection from "../StorageSection";
import ExportSection from "../ExportSection";
import JiraSection from "../JiraSection";

const TAB_TITLES: Record<string, string> = {
  general:      "General",
  labels:       "Labels",
  storage:      "Storage & Export",
  integrations: "Integrations",
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "general";

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3">
        <h1 className="text-base font-semibold text-[#151B26]">{TAB_TITLES[tab] ?? "Settings"}</h1>
      </div>
      <div className="px-4 sm:px-8 pb-8 flex flex-col gap-6 max-w-3xl">
        {tab === "general" && (
          <>
            <PermissionsSection />
            <AssignmentRequestsSection />
          </>
        )}
        {tab === "labels" && (
          <>
            <StatusSection />
            <PrioritySection />
            <TaskTypeSection />
          </>
        )}
        {tab === "storage" && (
          <>
            <StorageSection />
            <ExportSection />
          </>
        )}
        {tab === "integrations" && (
          <JiraSection />
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
