"use client";
import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";
import PermissionsSection from "./PermissionsSection";
import AssignmentRequestsSection from "./AssignmentRequestsSection";
import StatusSection from "./StatusSection";
import PrioritySection from "./PrioritySection";
import TaskTypeSection from "./TaskTypeSection";
import StorageSection from "./StorageSection";
import ExportSection from "./ExportSection";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-4 flex items-center gap-3">
        <Link href="/projects" className="p-1.5 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><ChevronLeft size={18} /></Link>
        <Settings size={18} className="text-[#6B6F76]" />
        <h1 className="text-lg font-semibold text-[#151B26]">Admin Settings</h1>
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
