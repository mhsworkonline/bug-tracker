"use client";

import { Suspense, useState } from "react";
import AdminHeader from "@/components/AdminHeader";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex flex-col">
      <AdminHeader onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="flex flex-1 min-h-0 relative">
        <Suspense fallback={null}>
          <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </Suspense>
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
