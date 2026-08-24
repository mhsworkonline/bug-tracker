import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth-server";
import InboxClient from "./InboxClient";

export default async function InboxPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <InboxClient userEmail={user.email ?? ""} />;
}
