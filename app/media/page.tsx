"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";

function MediaContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? "";
  const name = searchParams.get("name") ?? "attachment";
  const type = searchParams.get("type") ?? "";

  return (
    <div className="min-h-screen bg-[#0B0B0C] flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#151516] border-b border-[#2A2A2C]">
        <span className="text-sm text-[#E8E8E9] truncate">{name}</span>
        <a
          href={url}
          download={name}
          className="flex items-center gap-1.5 text-xs text-[#E8E8E9] hover:text-white px-2 py-1 rounded hover:bg-[#2A2A2C] flex-shrink-0"
        >
          <Download size={14} /> Download
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {type.startsWith("video/") ? (
          <video src={url} controls autoPlay className="max-w-full max-h-[85vh]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="max-w-full max-h-[85vh] object-contain" />
        )}
      </div>
    </div>
  );
}

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <MediaContent />
    </Suspense>
  );
}
