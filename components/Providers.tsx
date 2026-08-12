"use client";

import { ProjectProvider } from "@/lib/store";
import { AdminSettingsProvider } from "@/lib/adminSettingsContext";
import GlobalSearch from "@/components/GlobalSearch";
import InstallPrompt from "@/components/InstallPrompt";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AdminSettingsProvider>
      <ProjectProvider>
        {children}
        <GlobalSearch />
        <InstallPrompt />
      </ProjectProvider>
    </AdminSettingsProvider>
  );
}