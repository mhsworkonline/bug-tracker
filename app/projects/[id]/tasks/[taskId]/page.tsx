import { Suspense } from "react";
import { getUser } from "@/lib/auth-server";
import TaskDetailStandalone from "./TaskDetailStandalone";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const [{ id, taskId }, user] = await Promise.all([params, getUser()]);
  return (
    <Suspense fallback={null}>
      <TaskDetailStandalone projectId={id} taskId={taskId} userEmail={user?.email} />
    </Suspense>
  );
}
