import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { AppIconMark } from "@/lib/appIcon";

// Generates the manifest icons (192x192, 512x512, and a maskable 512 variant) on demand
// via ?size=&maskable=1 instead of shipping separate static PNG files. Cached hard since
// the icon never changes per-request.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const size = Math.min(1024, Math.max(16, parseInt(sp.get("size") ?? "512", 10) || 512));
  const maskable = sp.get("maskable") === "1";
  return new ImageResponse(<AppIconMark size={size} maskable={maskable} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
