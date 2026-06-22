const ADMIN_EMAIL = "admin@bugtracker.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SERVICE_KEY,
};

export async function GET() {
  // 1. Try to find existing user via SQL (service role Postgres REST)
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_auth_user_id`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_email: ADMIN_EMAIL }),
  });

  // 2. Create user via GoTrue admin endpoint directly
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: "Admin@123456",
      email_confirm: true,
    }),
  });

  const createBody = await createRes.json();
  return Response.json({
    status: createRes.status,
    ok: createRes.ok,
    body: createBody,
  });
}
