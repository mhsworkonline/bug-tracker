import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  const { filename, content_type } = await req.json();
  const config = await getStorageConfig();

  if (config.provider === "cloudinary") {
    const cdn = resolveCloudinary(config.cloudinary);
    if (!cdn.cloud_name) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }
    // Unsigned preset: browser uploads directly to Cloudinary
    if (cdn.upload_preset) {
      return NextResponse.json({
        provider: "cloudinary",
        cloud_name: cdn.cloud_name,
        upload_preset: cdn.upload_preset,
        folder: cdn.folder ?? "",
      });
    }
    // No upload preset — cannot do direct browser upload
    return NextResponse.json({ error: "Cloudinary upload preset is not configured. Go to Admin → Storage, add your unsigned Upload Preset, and save." }, { status: 400 });
  }

  if (config.provider === "cloudflare") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { cloudflare: cf } = config;
    const ext = filename.includes(".") ? filename.split(".").pop() : "";
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${cf.account_id}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cf.access_key_id, secretAccessKey: cf.secret_access_key },
    });
    const upload_url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: cf.bucket, Key: key, ContentType: content_type }),
      { expiresIn: 300 }
    );
    return NextResponse.json({
      provider: "cloudflare",
      upload_url,
      public_url: `${cf.public_url}/${key}`,
    });
  }

  if (config.provider === "supabase") {
    return NextResponse.json({ provider: "supabase" });
  }

  // local dev — fall back to old multipart route
  return NextResponse.json({ provider: "local" });
}
