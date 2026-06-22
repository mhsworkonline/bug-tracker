import TaskList from "@/components/TaskList";
import { getUser } from "@/lib/auth-server";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getUser()]);
  return (
    <div className="h-screen flex flex-col">
      <TaskList projectId={id} userEmail={user?.email} />
    </div>
  );
}
