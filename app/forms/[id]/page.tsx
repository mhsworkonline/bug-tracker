"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, AlertCircle } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "select";
  required: boolean;
  options?: string[];
}

interface Form {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  active: boolean;
  project_id: string;
}

export default function PublicFormPage({ params }: { params: { id: string } }) {
  const [form, setForm]       = useState<Form | null>(null);
  const [values, setValues]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    supabase.from("BT_forms").select("*").eq("id", params.id).single()
      .then(({ data }) => { setForm(data as Form ?? null); setLoading(false); });
  }, [params.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    // Validate required
    for (const f of form.fields) {
      if (f.required && !values[f.id]?.trim()) {
        setError(`"${f.label}" is required.`); return;
      }
    }
    setSubmitting(true); setError(null);
    const summaryField = form.fields[0];
    const taskName = (summaryField ? values[summaryField.id]?.trim() : "") || "Form submission";
    const description = form.fields.slice(1).filter(f => values[f.id]?.trim()).map(f => `**${f.label}:** ${values[f.id]}`).join("\n\n");
    // Get default section
    const { data: sections } = await supabase.from("BT_sections").select("id").eq("project_id", form.project_id).order("position").limit(1);
    const sectionId = sections?.[0]?.id ?? null;
    const { error: taskErr } = await supabase.from("BT_tasks").insert({
      project_id: form.project_id, section_id: sectionId, name: taskName, description: description || null,
      status: "not_started", position: 9999, completed: false,
    });
    if (taskErr) { setError("Submission failed. Please try again."); setSubmitting(false); return; }
    setDone(true); setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#6B6F76]">Loading…</div>;
  if (!form) return <div className="min-h-screen flex items-center justify-center text-sm text-[#6B6F76]">Form not found.</div>;
  if (!form.active) return <div className="min-h-screen flex items-center justify-center text-sm text-[#6B6F76]">This form is no longer accepting submissions.</div>;

  if (done) return (
    <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E8E9] shadow-sm p-10 text-center max-w-md w-full">
        <CheckCircle className="text-emerald-500 mx-auto mb-4" size={40} />
        <h2 className="text-xl font-bold text-[#151B26] mb-2">Submitted!</h2>
        <p className="text-sm text-[#6B6F76]">Thank you for your submission. The team has been notified.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E8E9] shadow-sm p-6 sm:p-10 w-full max-w-lg">
        <h1 className="text-xl sm:text-2xl font-bold text-[#151B26] mb-1">{form.name}</h1>
        {form.description && <p className="text-sm text-[#6B6F76] mb-6">{form.description}</p>}
        {!form.description && <div className="mb-6" />}
        <form onSubmit={submit} className="flex flex-col gap-4">
          {form.fields.map(f => (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#374151]">
                {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea rows={4} value={values[f.id] ?? ""} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))} className="w-full text-sm border border-[#E8E8E9] rounded-lg px-3 py-2 outline-none focus:border-[#4573D9] resize-none" />
              ) : f.type === "select" ? (
                <select value={values[f.id] ?? ""} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))} className="w-full text-sm border border-[#E8E8E9] rounded-lg px-3 py-2 outline-none bg-white focus:border-[#4573D9]">
                  <option value="">Select…</option>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} value={values[f.id] ?? ""} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))} className="w-full text-sm border border-[#E8E8E9] rounded-lg px-3 py-2 outline-none focus:border-[#4573D9]" />
              )}
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#4573D9] text-white font-semibold text-sm rounded-lg hover:bg-[#3F65C4] disabled:opacity-50 mt-2">
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
