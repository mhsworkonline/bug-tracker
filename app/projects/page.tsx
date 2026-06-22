import { getUser } from "@/lib/auth-server";
import { ADMIN_EMAIL } from "@/lib/constants";
import { createClient } from "@supabase/supabase-js";
import ProjectsPageClient from "@/components/ProjectsPageClient";

export default async function ProjectsPage() {
  const user = await getUser();
  const isAdmin = user?.email === ADMIN_EMAIL;

  let allowedProjectIds: string[] | null = null;
  if (!isAdmin && user) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await sb.from("BT_project_members").select("project_id").eq("user_id", user.id);
    allowedProjectIds = (data ?? []).map((r: { project_id: string }) => r.project_id);
  }

  return <ProjectsPageClient isAdmin={isAdmin} userEmail={user?.email} allowedProjectIds={allowedProjectIds} />;
}
