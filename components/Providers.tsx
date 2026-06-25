"use client";

import { ProjectProvider } from "@/lib/store";
import { AdminSettingsProvider } from "@/lib/adminSettingsContext";
import GlobalSearch from "@/components/GlobalSearch";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AdminSettingsProvider>
      <ProjectProvider>
        {children}
        <GlobalSearch />
      </ProjectProvider>
    </AdminSettingsProvider>
  );
}
