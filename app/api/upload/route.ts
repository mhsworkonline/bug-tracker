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
  // Fall back to env
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

export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const config = await getStorageConfig();

  if (config.provider === "cloudflare") return uploadToR2(file, config);
  if (config.provider === "cloudinary") return uploadToCloudinary(file, config);
  if (config.provider === "local")      return uploadLocally(file);
  return uploadToSupabase(file);
}

async function uploadToSupabase(file: File): Promise<NextResponse> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = createServerClient();
  const ext  = path.extname(file.name);
  const key  = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from("bt-attachments").upload(key, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from("bt-attachments").getPublicUrl(key);
  return NextResponse.json({ url: publicUrl, name: file.name });
}

async function uploadLocally(file: File): Promise<NextResponse> {
  const { writeFile, mkdir } = await import("fs/promises");
  const bytes = await file.arrayBuffer();
  const ext   = path.extname(file.name);
  const safe  = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const dir   = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, safe), Buffer.from(bytes));
  return NextResponse.json({ url: `/uploads/${safe}`, name: file.name });
}

async function uploadToR2(file: File, config: StorageConfig): Promise<NextResponse> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { cloudflare: cf } = config;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cf.account_id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cf.access_key_id, secretAccessKey: cf.secret_access_key },
  });
  const ext  = path.extname(file.name);
  const key  = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const bytes = await file.arrayBuffer();
  await client.send(new PutObjectCommand({ Bucket: cf.bucket, Key: key, Body: Buffer.from(bytes), ContentType: file.type }));
  return NextResponse.json({ url: `${cf.public_url}/${key}`, name: file.name });
}

function resolveCloudinary(config: StorageConfig["cloudinary"]): StorageConfig["cloudinary"] {
  if (config.cloud_name) return config;
  const url = process.env.CLOUDINARY_URL ?? "";
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return config;
  return { ...config, api_key: m[1], api_secret: m[2], cloud_name: m[3] };
}

async function uploadToCloudinary(file: File, config: StorageConfig): Promise<NextResponse> {
  const cdn = resolveCloudinary(config.cloudinary);
  if (!cdn.cloud_name) return NextResponse.json({ error: "Cloudinary not configured. Add credentials in /admin or set CLOUDINARY_URL in .env" }, { status: 500 });

  const bytes = await file.arrayBuffer();

  if (cdn.upload_preset) {
    // Unsigned upload — REST API, no auth required
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: file.type }), file.name);
    fd.append("upload_preset", cdn.upload_preset);
    if (cdn.folder) fd.append("folder", cdn.folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cdn.cloud_name}/auto/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? "Cloudinary upload failed" }, { status: 500 });
    return NextResponse.json({ url: data.secure_url, name: file.name });
  }

  // Signed upload via SDK (no preset configured)
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ cloud_name: cdn.cloud_name, api_key: cdn.api_key, api_secret: cdn.api_secret });
  const opts: Record<string, string> = { resource_type: "auto" };
  if (cdn.folder) opts.folder = cdn.folder;

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(opts, (err, res) => {
      if (err || !res) reject(err ?? new Error("No response"));
      else resolve(res as { secure_url: string });
    }).end(Buffer.from(bytes));
  });

  return NextResponse.json({ url: result.secure_url, name: file.name });
}
