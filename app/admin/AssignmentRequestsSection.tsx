"use client";
import { useEffect, useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";

interface Request {
  id: string;
  task_id: string;
  task_name: string;
  requester_email: string;
  assignee_email: string;
  status: string;
  created_at: string;
}

export default function AssignmentRequestsSection() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/assignment-requests");
    const d = await r.json();
    setRequests(d.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "approved" | "rejected") => {
    setActing(id);
    await fetch(`/api/admin/assignment-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    await load();
  };

  const pending = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  return (
    <section className="bg-white rounded-xl border border-[#E8E8E9] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[#151B26]">
          Assignment Requests
          {pending.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-[#EEF2FB] text-[#4573D9] text-xs rounded-full">{pending.length}</span>}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B6F76]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : pending.length === 0 ? (
        <p className="text-sm text-[#B0B3B8]">No pending requests</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#F5F5F5]">
          {pending.map(req => (
            <div key={req.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-[#151B26]">
                  <span className="font-medium">{req.requester_email}</span>
                  {" wants to assign "}
                  <span className="font-medium">{req.assignee_email}</span>
                  {" to "}
                  <span className="italic">"{req.task_name || "Untitled"}"</span>
                </p>
                <p className="text-xs text-[#B0B3B8] mt-0.5">{new Date(req.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1 ml-4">
                <button
                  onClick={() => act(req.id, "approved")}
                  disabled={acting === req.id}
                  className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-600 text-xs rounded-lg hover:bg-green-100 disabled:opacity-50"
                >
                  {acting === req.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                </button>
                <button
                  onClick={() => act(req.id, "rejected")}
                  disabled={acting === req.id}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-500 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50"
                >
                  <X size={11} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-[#6B6F76] cursor-pointer hover:text-[#151B26]">Recent resolved ({resolved.length})</summary>
          <div className="flex flex-col divide-y divide-[#F5F5F5] mt-2">
            {resolved.slice(0, 10).map(req => (
              <div key={req.id} className="flex items-center justify-between py-2">
                <p className="text-xs text-[#6B6F76]">
                  {req.requester_email} → {req.assignee_email} on "{req.task_name}"
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${req.status === "approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
