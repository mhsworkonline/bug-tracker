import { getUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import MyTasksClient from "./MyTasksClient";

export default async function MyTasksPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <MyTasksClient userEmail={user.email ?? ""} />;
}
