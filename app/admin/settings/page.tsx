"use client";
import AdminHeader from "@/components/AdminHeader";
import PermissionsSection from "../PermissionsSection";
import AssignmentRequestsSection from "../AssignmentRequestsSection";
import StatusSection from "../StatusSection";
import PrioritySection from "../PrioritySection";
import TaskTypeSection from "../TaskTypeSection";
import StorageSection from "../StorageSection";
import ExportSection from "../ExportSection";

export default function AdminSettingsPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <AdminHeader />
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3">
        <h1 className="text-base font-semibold text-[#151B26]">Settings</h1>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">
        <PermissionsSection />
        <AssignmentRequestsSection />
        <StatusSection />
        <PrioritySection />
        <TaskTypeSection />
        <StorageSection />
        <ExportSection />
      </div>
    </div>
  );
}
