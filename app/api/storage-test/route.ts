import { NextResponse } from "next/server";
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

const TEST_CONTENT = "bug-tracker-storage-test-ok";
const TEST_FILENAME = `storage-test-${Date.now()}.txt`;

export async function POST() {
  const config = await getStorageConfig();

  try {
    if (config.provider === "cloudflare") {
      const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const { cf } = { cf: config.cloudflare };

      const missing = [
        !cf.account_id        && "Account ID",
        !cf.access_key_id     && "Access Key ID",
        !cf.secret_access_key && "Secret Key",
        !cf.bucket            && "Bucket",
        !cf.public_url        && "Public URL",
      ].filter(Boolean);
      if (missing.length) {
        return NextResponse.json({ ok: false, error: `Missing fields: ${missing.join(", ")}` });
      }

      const client = new S3Client({
        region: "auto",
        endpoint: `https://${cf.account_id}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: cf.access_key_id, secretAccessKey: cf.secret_access_key },
      });

      const key = `test/${TEST_FILENAME}`;

      // Upload
      await client.send(new PutObjectCommand({
        Bucket: cf.bucket,
        Key: key,
        Body: TEST_CONTENT,
        ContentType: "text/plain",
      }));

      const publicUrl = `${cf.public_url}/${key}`;

      // Verify public access
      const check = await fetch(publicUrl).catch(() => null);
      const readable = check?.ok ?? false;

      // Cleanup
      await client.send(new DeleteObjectCommand({ Bucket: cf.bucket, Key: key })).catch(() => {});

      if (!readable) {
        return NextResponse.json({
          ok: false,
          error: `File uploaded successfully but public URL returned ${check?.status ?? "network error"}. Check that your bucket has public access enabled and the Public URL is correct.`,
          url: publicUrl,
        });
      }

      return NextResponse.json({ ok: true, provider: "cloudflare", url: publicUrl });
    }

    if (config.provider === "cloudinary") {
      const cdn = config.cloudinary;
      const resolvedCdn = cdn.cloud_name ? cdn : (() => {
        const url = process.env.CLOUDINARY_URL ?? "";
        const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
        return m ? { ...cdn, api_key: m[1], api_secret: m[2], cloud_name: m[3] } : cdn;
      })();

      if (!resolvedCdn.cloud_name) {
        return NextResponse.json({ ok: false, error: "Cloudinary cloud name is not configured." });
      }

      if (resolvedCdn.upload_preset) {
        // Unsigned upload test
        const fd = new FormData();
        fd.append("file", new Blob([TEST_CONTENT], { type: "text/plain" }), TEST_FILENAME);
        fd.append("upload_preset", resolvedCdn.upload_preset);
        if (resolvedCdn.folder) fd.append("folder", resolvedCdn.folder);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${resolvedCdn.cloud_name}/raw/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) return NextResponse.json({ ok: false, error: data.error?.message ?? "Cloudinary upload failed" });
        return NextResponse.json({ ok: true, provider: "cloudinary", url: data.secure_url });
      } else {
        // Signed upload test
        const { v2: cloudinary } = await import("cloudinary");
        cloudinary.config({ cloud_name: resolvedCdn.cloud_name, api_key: resolvedCdn.api_key, api_secret: resolvedCdn.api_secret });
        const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
          const opts: Record<string, string> = { resource_type: "raw" };
          if (resolvedCdn.folder) opts.folder = resolvedCdn.folder;
          cloudinary.uploader.upload_stream(opts, (err, res) => {
            if (err || !res) reject(err ?? new Error("No response")); else resolve(res as { secure_url: string });
          }).end(Buffer.from(TEST_CONTENT));
        });
        return NextResponse.json({ ok: true, provider: "cloudinary", url: result.secure_url });
      }
    }

    if (config.provider === "supabase") {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = createServerClient();
      const key = `test/${TEST_FILENAME}`;
      const { error } = await supabase.storage.from("bt-attachments").upload(key, Buffer.from(TEST_CONTENT), { contentType: "text/plain", upsert: true });
      if (error) return NextResponse.json({ ok: false, error: error.message });
      const { data: { publicUrl } } = supabase.storage.from("bt-attachments").getPublicUrl(key);
      await supabase.storage.from("bt-attachments").remove([key]).catch(() => {});
      return NextResponse.json({ ok: true, provider: "supabase", url: publicUrl });
    }

    if (config.provider === "local") {
      const { writeFile, unlink, mkdir } = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "uploads", "test");
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, TEST_FILENAME);
      await writeFile(filePath, TEST_CONTENT);
      await unlink(filePath).catch(() => {});
      return NextResponse.json({ ok: true, provider: "local", url: `/uploads/test/${TEST_FILENAME}` });
    }

    return NextResponse.json({ ok: false, error: "Unknown provider" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unexpected error" });
  }
}
