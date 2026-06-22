import { NextRequest, NextResponse } from "next/server";
import path from "path";
import type { StorageConfig } from "@/lib/adminSettings";
import { DEFAULT_STORAGE } from "@/lib/adminSettings";

async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const sb = createServerClient();
    const { data } = await sb.from("BT_settings").select("value").eq("key", "storage_config").single();
    if (data?.value) return data.value as StorageConfig;
  } catch { /* fall through */ }
  return {
    ...DEFAULT_STORAGE,
    provider: (process.env.STORAGE_PROVIDER as StorageConfig["provider"]) ?? "supabase",
    cloudflare: {
      account_id:        process.env.CF_R2_ACCOUNT_ID        ?? "",
      access_key_id:     process.env.CF_R2_ACCESS_KEY_ID     ?? "",
      secret_access_key: process.env.CF_R2_SECRET_ACCESS_KEY ?? "",
      bucket:            process.env.CF_R2_BUCKET            ?? "",
      public_url:        process.env.CF_R2_PUBLIC_URL        ?? "",
    },
    cloudinary: DEFAULT_STORAGE.cloudinary,
  };
}

function resolveCloudinary(config: StorageConfig["cloudinary"]): StorageConfig["cloudinary"] {
  if (config.cloud_name) return config;
  const url = process.env.CLOUDINARY_URL ?? "";
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return config;
  return { ...config, api_key: m[1], api_secret: m[2], cloud_name: m[3] };
}

async function deleteFromCloudinary(fileUrl: string, config: StorageConfig) {
  const cdn = resolveCloudinary(config.cloudinary);
  if (!cdn.cloud_name || !cdn.api_key || !cdn.api_secret) return;

  const clean = fileUrl.split("?")[0];
  const typeMatch  = clean.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//);
  const idMatch    = clean.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
  const resourceType = typeMatch?.[1] ?? "image";
  const publicId     = idMatch?.[1] ?? "";
  if (!publicId) return;

  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ cloud_name: cdn.cloud_name, api_key: cdn.api_key, api_secret: cdn.api_secret });
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType as "image" | "video" | "raw" });
}

async function deleteFromR2(fileUrl: string, config: StorageConfig) {
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { cloudflare: cf } = config;
  const key = fileUrl.replace(cf.public_url + "/", "");
  if (!key) return;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cf.account_id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cf.access_key_id, secretAccessKey: cf.secret_access_key },
  });
  await client.send(new DeleteObjectCommand({ Bucket: cf.bucket, Key: key }));
}

async function deleteFromSupabase(fileUrl: string) {
  const clean = fileUrl.split("?")[0];
  const match = clean.match(/\/storage\/v1\/object\/public\/bt-attachments\/(.+)$/);
  const key = match?.[1];
  if (!key) return;
  const { createServerClient } = await import("@/lib/supabase-server");
  const sb = createServerClient();
  await sb.storage.from("bt-attachments").remove([key]);
}

async function deleteLocally(fileUrl: string) {
  const { unlink } = await import("fs/promises");
  const filePath = path.join(process.cwd(), "public", fileUrl);
  await unlink(filePath).catch(() => {});
}

export async function POST(req: NextRequest) {
  let url: string;
  try { ({ url } = await req.json()); }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  const config = await getStorageConfig();

  try {
    if (config.provider === "cloudinary") await deleteFromCloudinary(url, config);
    else if (config.provider === "cloudflare") await deleteFromR2(url, config);
    else if (config.provider === "supabase")   await deleteFromSupabase(url);
    else if (config.provider === "local")      await deleteLocally(url);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Storage delete failed:", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
