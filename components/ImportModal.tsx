"use client";
import { useState, useRef } from "react";
import { X, Upload, Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ projectId, onClose, onImported }: Props) {
  const [dragging, setDragging]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<number | null>(null);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "json"].includes(ext ?? "")) { setError("Only CSV or JSON files supported."); return; }
    setImporting(true); setError("");
    const content = await file.text();
    const r = await fetch(`/api/projects/${projectId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: ext as "csv" | "json", content }),
    });
    const d = await r.json();
    setImporting(false);
    if (d.error) { setError(d.error); return; }
    setResult(d.imported);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) doImport(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doImport(f);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#151B26]">Import tasks</h2>
          <button onClick={onClose} className="p-1 text-[#6B6F76] hover:bg-[#F5F5F5] rounded"><X size={16} /></button>
        </div>

        <p className="text-xs text-[#6B6F76] mb-4">
          Supported formats: <strong>CSV</strong> (matching our export headers) or <strong>JSON</strong> (exported project file).
          Tasks will be added to this project; sections are created if they don't exist.
        </p>

        {result !== null ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-sm font-medium text-[#151B26]">{result} task{result !== 1 ? "s" : ""} imported</p>
            <button onClick={() => { onImported(); onClose(); }}
              className="mt-2 px-4 py-1.5 bg-[#4573D9] text-white text-sm rounded-lg hover:bg-[#3F65C4]">Done</button>
          </div>
        ) : importing ? (
          <div className="flex items-center justify-center py-10 gap-2 text-[#6B6F76] text-sm">
            <Loader2 size={16} className="animate-spin" /> Importing…
          </div>
        ) : (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-10 flex flex-col items-center gap-2 cursor-pointer transition-colors ${dragging ? "border-[#4573D9] bg-[#EEF2FB]" : "border-[#E8E8E9] hover:border-[#4573D9]"}`}
            >
              <Upload size={24} className="text-[#6B6F76]" />
              <p className="text-sm text-[#151B26]">Drop file here or <span className="text-[#4573D9]">browse</span></p>
              <p className="text-xs text-[#6B6F76]">.csv or .json</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.json" className="sr-only" onChange={onFile} />
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
