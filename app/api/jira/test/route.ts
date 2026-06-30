import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { domain, email, api_token, project_key } = await req.json();
  if (!domain || !email || !api_token || !project_key)
    return NextResponse.json({ message: "All fields are required." }, { status: 400 });

  const base = domain.replace(/\/$/, "");
  const auth = Buffer.from(`${email}:${api_token}`).toString("base64");

  try {
    const res = await fetch(`${base}/rest/api/3/project/${project_key}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (res.status === 401) return NextResponse.json({ message: "Invalid email or API token." }, { status: 401 });
    if (res.status === 404) return NextResponse.json({ message: `Project key "${project_key}" not found in Jira.` }, { status: 404 });
    if (!res.ok)            return NextResponse.json({ message: `Jira returned error ${res.status}.` }, { status: 400 });
    const data = await res.json();
    return NextResponse.json({ message: `Connected! Project: ${data.name}` });
  } catch {
    return NextResponse.json({ message: "Could not reach Jira. Check your domain." }, { status: 500 });
  }
}
