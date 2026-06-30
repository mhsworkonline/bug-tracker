"use client";

import { Suspense } from "react";
import AdminHeader from "@/components/AdminHeader";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFBFC] flex flex-col">
      <AdminHeader />
      <div className="flex flex-1 min-h-0">
        <Suspense fallback={null}>
          <AdminSidebar />
        </Suspense>
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
