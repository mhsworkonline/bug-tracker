"use client";
import AdminHeader from "@/components/AdminHeader";
import ActivityLogSection from "../ActivityLogSection";

export default function ActivityLogPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <AdminHeader />
      <div className="bg-white border-b border-[#E8E8E9] px-4 sm:px-8 py-3">
        <h1 className="text-base font-semibold text-[#151B26]">Activity Log</h1>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <ActivityLogSection />
      </div>
    </div>
  );
}
