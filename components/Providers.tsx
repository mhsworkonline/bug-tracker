"use client";

import { ProjectProvider } from "@/lib/store";
import { AdminSettingsProvider } from "@/lib/adminSettingsContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AdminSettingsProvider>
      <ProjectProvider>{children}</ProjectProvider>
    </AdminSettingsProvider>
  );
}
