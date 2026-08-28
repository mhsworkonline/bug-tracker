import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }
  if (user && pathname.startsWith("/admin") && user.email !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return response;
}

export const config = {
  // icon/apple-icon/manifest.webmanifest must stay public (unauthenticated) — the browser's
  // install-prompt engine and OS favicon fetches request these without any auth context.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|api/).*)"],
};
