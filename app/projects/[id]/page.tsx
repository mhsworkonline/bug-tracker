import TaskList from "@/components/TaskList";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="h-screen flex flex-col">
      <TaskList projectId={id} />
    </div>
  );
}
